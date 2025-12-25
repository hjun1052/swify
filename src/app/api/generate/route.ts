import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { scrapeWeb, scrapeImages } from "@/lib/crawler";

// Interfaces match the frontend expectation
export interface Slide {
  id: string;
  imageUrl: string;
  imageQuery?: string; // Added for client-side hydration
  text: string;
  audioUrl?: string;
  duration: number; // Will use audio duration in frontend or fallback
}

export interface VideoShort {
  id: string;
  title: string;
  creator: string;
  slides: Slide[];
  suggestedNextQuery?: string;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"; // New field
  bgmIndex: number;
  sources?: { title: string; href: string }[];
  style?: string;
  category?: string;
}

const AVAILABLE_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;

const STYLE_CATEGORY_MAP: Record<string, string> = {
  learn: "LEARN",
  explore: "EXPLORE",
  brief: "BRIEF",
  research: "RESEARCH",
  invest: "INVEST",
};

// DuckDuckGo wraps outbound links with a redirector; strip it so the UI gets clean URLs.
function normalizeSourceHref(href: string | undefined) {
  if (!href) return "";

  try {
    const url = new URL(href);
    if (
      url.hostname.includes("duckduckgo.com") &&
      url.pathname.startsWith("/l/") &&
      url.searchParams.has("uddg")
    ) {
      return decodeURIComponent(url.searchParams.get("uddg") as string);
    }
    return href;
  } catch {
    return href;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    // 1. Deep Search: Generate Search Queries
    console.log(`[Deep Search] Generating queries for: ${query}`);
    const queryGenCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant. Generate 2~3 specific, distinct, and high-quality web search queries to find the LATEST and most relevant information for the user's topic. Return JSON: { queries: string[] }",
        },
        {
          role: "user",
          content: `Topic: ${query}. Current Date: ${
            new Date().toISOString().split("T")[0]
          }`,
        },
      ],
      model: "gpt-4o",
      response_format: { type: "json_object" },
    });

    const queryJson = JSON.parse(
      queryGenCompletion.choices[0].message.content || "{}"
    );
    const searchQueries = queryJson.queries || [query];
    console.log(`[Deep Search] Queries: ${JSON.stringify(searchQueries)}`);

    // 2. Parallel Scraping
    const contextResults = await Promise.all(
      searchQueries.map((q: string) => scrapeWeb(q))
    );

    // Aggregate and Deduplicate Context & Sources
    const allOrganicResults = contextResults.flatMap((r) => r.organic || []);

    // Deduplicate sources by URL
    const uniqueSourcesInput = new Map();
    allOrganicResults.forEach((item) => {
      const cleanHref = normalizeSourceHref(item.href);
      if (!cleanHref) return;
      if (!uniqueSourcesInput.has(cleanHref)) {
        uniqueSourcesInput.set(cleanHref, {
          title: item.title,
          href: cleanHref,
        });
      }
    });
    const sources = Array.from(uniqueSourcesInput.values());

    const allSnippets = allOrganicResults;
    const uniqueSnippets = Array.from(
      new Set(allSnippets.map((s) => s.snippet))
    );
    const context = uniqueSnippets.join("\n\n");
    console.log(`[Deep Search] Context gathered: ${context.length} chars`);

    // 3. Generate Script via GPT-4o
    const langParam = searchParams.get("lang") || "en";
    const lenParam = searchParams.get("len") || "medium";
    const styleParam = searchParams.get("style") || "learn";

    const languageMap: Record<string, string> = {
      en: "English",
      ko: "Korean",
      es: "Spanish",
      ja: "Japanese",
    };
    const targetLanguage = languageMap[langParam] || "English";

    const lengthMap: Record<string, string> = {
      short: "4 to 6 slides",
      medium: "8 to 12 slides",
      long: "15 to 20 slides",
    };
    const targetLength = lengthMap[lenParam] || "8 to 12 slides";

    // Style Definitions - Enhanced for Storytelling
    const STYLE_PROMPTS: Record<string, string> = {
      learn: `
        ROLE: Expert Teacher / Storyteller.
        FOCUS: Step-by-step logic, clear mental models, and "Aha!" moments.
        STRUCTURE: Hook -> Conceptual Foundation -> Detailed Mechanism -> Real-world Significance -> Takeaway.
        TONE: Educational, insightful, engaging. Connect every slide to the next with logical bridges.
      `,
      explore: `
        ROLE: Enthusiastic Discovery Guide.
        FOCUS: Unveiling mysteries, showing the "weird" side of topics, and creating curiosity.
        STRUCTURE: Intense Hook -> Context of the Mystery -> Unveiling Fact 1 -> Escalation/Context -> The "Big Reveal" -> Reflection.
        TONE: Adventurous, rhythmic, surprising. Use "But here's where it gets even stranger" style transitions.
      `,
      brief: `
        ROLE: Strategic Intelligence Analyst.
        FOCUS: High-density value, immediate impact, and current status.
        STRUCTURE: Key Insight -> Supporting Evidence -> The Ripple Effect -> Actionable Future.
        TONE: Crisp, authoritative, high-energy. Focus on the 'Chain of Connectivity' between events.
      `,
      research: `
        ROLE: Lead Investigative Scientist.
        FOCUS: Evidence chains, conflicting theories, and the quest for truth.
        STRUCTURE: The Core Question -> Methodology/Theories -> The Breakthrough Evidence -> Unresolved Conflict -> Conclusion.
        TONE: Precise, slightly dramatic, curious.
      `,
      invest: `
        ROLE: Visionary Market Analyst.
        FOCUS: Economic momentum, the "Why Now?", and competitive landscapes.
        STRUCTURE: The Market Shift -> The Catalyst -> Winners vs Losers -> The Strategic Bet.
        TONE: Sharp, intense, forward-leaning.
      `,
    };

    // Default to 'learn' if unknown
    const selectedStyle = STYLE_PROMPTS[styleParam] || STYLE_PROMPTS["learn"];

    const prompt = `
    You are an elite short-form content director. Your goal is to turn search data into a COHESIVE, ADDICTIVE, and SUBSTANTIAL narrative.
    
    ## ABSOLUTE RULE (DO NOT VIOLATE)
    - The value of "image_query" MUST be written in ENGLISH ONLY.
    - This rule OVERRIDES Target Language.
    - If ANY non-English character appears in "image_query", the entire output is INVALID.
    - Fields except "image_query" MUST be written in Target Language.
    ---
    ## YOUR DIRECTIVE
    ${selectedStyle}
    ---
    
    ## TOPIC & CONTEXT
    Query: "${query}"
    Target Language: "${targetLanguage}"
    Target Length: "${targetLength}"
    
    ## RESEARCH MATERIAL
    """
    ${context.slice(0, 15000)}
    """
    
    ---
    
    ## NARRATIVE CONSTRAINTS (CRITICAL)
    1. **NARRATIVE ARC**: The script MUST HAVE A BEGINNING, MIDDLE, and END. It cannot be localized facts. 
    2. **TRANSITIONAL FLOW**: Each slide must explicitly transition from the previous one. Use connectors like: "Because of this...", "However, the real secret is...", "This leads us to...", "Meanwhile, in the lab...".
    3. **SUBSTANCE OVER FILLER**: 
       - NEVER ask multiple rhetorical questions in a row. 
       - NEVER say "I'll tell you more" or "Watch until the end".
       - Every slide MUST deliver a piece of information that builds the argument.
    4. **ONE STORY, NOT FIVE**: Do not mention 5 different topics. Stick to ONE main narrative thread from the research and explore it deeply.
    5. **WHY > WHAT**: Don't just list facts. Explain why this matters to the viewer's world.
    
    ---
    
    ## OUTPUT FORMAT (STRICT JSON)
    {
      "reasoning": "How did you construct the narrative arc from the research? (Explain the logical flow)",
      "title": "A punchy, context-rich title (in ${targetLanguage})",
      "suggestedNextQuery": "A logical deep-dive follow-up question (in ${targetLanguage})",
      "slides": [
        {
          "text": "1-2 powerful, punchy yet short sentences for AI narration. No fluff.",
          "image_query": "A Single one short common 'English word' search query for Unsplash matches the visual. STRICTLY ENGLISH ONLY. Do NOT use Korean. Translate the concept if needed. (e.g., 'city', 'clock', 'galaxy')."
        }
      ]
    }
Ensure the "title" is clear and accurately reflects the main topic (e.g. "The Future of AI" or "SpaceX Starship"), as it will be used as a fallback for image searches if specific queries fail.
Ensure "suggestedNextQuery" is a related "rabbit hole" topic (3-4 words) that would lead to another deep-dive video.

Output only valid JSON.`;

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-5.1",
      response_format: { type: "json_object" },
    });

    const scriptJson = JSON.parse(
      chatCompletion.choices[0].message.content || "{}"
    );
    // Log reasoning for debugging/monitoring quality
    console.log(`[Swify v5] Reasoning: ${scriptJson.reasoning}`);
    const rawSlides = scriptJson.slides || [];

    // 3. Process Assets (Lightweight - Placeholders only)
    const processedSlides = rawSlides.map(
      (s: { image_query: string; text: string }, i: number) => ({
        ...s, // Keep original query
        id: `s-${i}`,
        imageUrl: "", // Client will fetch this via /api/augment
        imageQuery: s.image_query, // Pass query to client so it can request the image
        text: s.text,
        audioUrl: "", // Client will fetch this via /api/augment
        duration: 5, // Default fallback
      })
    );

    const randomVoice: (typeof AVAILABLE_VOICES)[number] =
      AVAILABLE_VOICES[Math.floor(Math.random() * AVAILABLE_VOICES.length)];

    const videoTitle = scriptJson.title || query;

    // 4. Pre-hydrate the VERY FIRST slide of the first video for instant playback
    if (processedSlides.length > 0) {
      const firstSlide = processedSlides[0];
      try {
        console.log(`[Swify] Pre-hydrating first slide for: ${videoTitle}`);
        const [imageUrl, audioUrl] = await Promise.all([
          scrapeImages(firstSlide.imageQuery, videoTitle),
          (async () => {
            const mp3 = await openai.audio.speech.create({
              model: "tts-1",
              voice: randomVoice,
              input: firstSlide.text,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            return `data:audio/mp3;base64,${buffer.toString("base64")}`;
          })(),
        ]);

        processedSlides[0] = {
          ...firstSlide,
          imageUrl:
            imageUrl ||
            "https://placehold.co/600x400?text=Pre-hydration+Failed",
          audioUrl: audioUrl || "",
        };
      } catch (e) {
        console.error("[Swify] Pre-hydration failed", e);
      }
    }

    const videoId = `gen-${Date.now()}`;
    const bgmIndex = Date.now() % 9; // Deterministic based on creation time for this specific generation instance

    const video: VideoShort = {
      id: videoId,
      title: videoTitle,
      creator: "Swify AI",
      slides: processedSlides,
      suggestedNextQuery: scriptJson.suggestedNextQuery, // Pass next query to frontend
      voice: randomVoice,
      bgmIndex: bgmIndex,
      sources: sources,
      style: styleParam,
      category: STYLE_CATEGORY_MAP[styleParam] || "LEARN",
    };

    return NextResponse.json({ videos: [video] });
  } catch (error: unknown) {
    console.error("Video Generation Error:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
