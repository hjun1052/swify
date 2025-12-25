import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { scrapeImages } from "@/lib/crawler";

export async function POST(request: Request) {
  try {
    const { text, imageQuery, voice, topic } = await request.json();

    if (!text || !imageQuery) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    // Process parallelly
    const [imageUrl, audioUrl] = await Promise.all([
      // 1. Image Scrape
      (async () => {
        try {
          const img = await scrapeImages(imageQuery, topic);
          return img || "https://placehold.co/600x400?text=Image+Not+Found";
        } catch (e) {
          console.error("Augment: Image scrape fail", e);
          return "https://placehold.co/600x400?text=Image+Error";
        }
      })(),

      // 2. TTS Generation
      (async () => {
        try {
          const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: voice || "alloy",
            input: text,
          });
          const buffer = Buffer.from(await mp3.arrayBuffer());
          return `data:audio/mp3;base64,${buffer.toString("base64")}`;
        } catch (e) {
          console.error("Augment: TTS fail", e);
          return null;
        }
      })(),
    ]);

    return NextResponse.json({ imageUrl, audioUrl });
  } catch (error) {
    console.error("Augment API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
