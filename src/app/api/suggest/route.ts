import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic");

  if (!topic) {
    return NextResponse.json({ error: "Topic required" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a content strategist. Generate 3 distinct, engaging, and specific follow-up video topics based on the user's input. These should be 'Rabbit Hole' style deep dives, not just generic news. Return JSON: { suggestions: string[] }",
        },
        {
          role: "user",
          content: `Topic: ${topic}`,
        },
      ],
      model: "gpt-4o",
      response_format: { type: "json_object" },
    });

    const json = JSON.parse(completion.choices[0].message.content || "{}");
    const suggestions = json.suggestions || [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggestion failed:", error);
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 });
  }
}
