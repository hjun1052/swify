import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { question, videoContent } = await req.json();

    if (!question || !videoContent) {
      return NextResponse.json(
        { error: "Question and content required" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant built into Swify, a learning platform. 
          Use the provided video transcript/outline to answer the user's question concisely. 
          Keep your answer under 2-3 sentences. If the answer isn't in the context, say you don't know but try to be helpful.`,
        },
        {
          role: "user",
          content: `Video Context:\n${videoContent}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 150,
    });

    const answer =
      response.choices[0].message.content ||
      "I'm sorry, I couldn't generate an answer.";

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Ask AI error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
