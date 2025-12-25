import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";
import { getTodayRange } from "@/lib/date";
import { openai } from "@/lib/openai";

const REFLECTION_MODEL = "gpt-4o-mini";
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ko: "Korean",
  es: "Spanish",
  ja: "Japanese",
};

function formatSummary(entries: { title: string; category: string }[]) {
  const categoryTotals = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {});

  const categoryLines = Object.entries(categoryTotals)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(", ");

  const titleLines = entries.map((entry, idx) => `${idx + 1}. ${entry.title}`).join("\n");

  return {
    text: `Categories watched: ${categoryLines}

Videos:
${titleLines}`,
    categories: Object.entries(categoryTotals).map(([category, count]) => ({
      category,
      count,
    })),
    titles: entries.map((entry) => entry.title),
  };
}

async function fetchTodayEntries(userId: string) {
  const { start, end } = getTodayRange();
  return prisma.watchHistory.findMany({
    where: {
      userId,
      watchedAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { watchedAt: "desc" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const languageParam = typeof body?.language === "string" ? body.language : "en";
    const forceNew = Boolean(body?.forceNew);
    const targetLanguage = LANGUAGE_LABELS[languageParam] || "English";

    const user = await getDefaultUser();
    const entries = await fetchTodayEntries(user.id);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "오늘 시청한 영상이 없어요." },
        { status: 400 }
      );
    }

    const { start, end } = getTodayRange();
    const existing = await prisma.dailyReflection.findFirst({
      where: {
        userId: user.id,
        reflectionDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing && !forceNew) {
      return NextResponse.json({
        reflection: {
          id: existing.id,
          question: existing.question,
        },
        summary: safeParseSummary(existing.summary),
      });
    }

    const summary = formatSummary(entries);
    const completion = await openai.chat.completions.create({
      model: REFLECTION_MODEL,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            `You are a mindful coach. Given a summary of videos someone watched today, craft one open-ended question that invites them to synthesize what it means for them. No bullet points, just one concise question. Respond entirely in ${targetLanguage}.`,
        },
        {
          role: "user",
          content: `Here is their viewing summary:\n${summary.text}`,
        },
      ],
    });

    const question = completion.choices[0].message.content?.trim();
    if (!question) {
      throw new Error("Question generation failed");
    }

    const reflection = await prisma.dailyReflection.create({
      data: {
        userId: user.id,
        question,
        summary: JSON.stringify({
          categories: summary.categories,
          titles: summary.titles,
        }),
      },
    });

    return NextResponse.json({
      reflection: {
        id: reflection.id,
        question,
      },
      summary: {
        categories: summary.categories,
        titles: summary.titles,
      },
    });
  } catch (error) {
    console.error("[Reflection] POST failed", error);
    return NextResponse.json(
      { error: "질문을 만들지 못했어요." },
      { status: 500 }
    );
  }
}

function safeParseSummary(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, answer } = body || {};
    if (!id || !answer) {
      return NextResponse.json(
        { error: "reflection id와 답변이 필요해요." },
        { status: 400 }
      );
    }

    const updated = await prisma.dailyReflection.update({
      where: { id },
      data: {
        answer,
        reflectionDate: new Date(),
      },
    });

    return NextResponse.json({ reflection: updated });
  } catch (error) {
    console.error("[Reflection] PATCH failed", error);
    return NextResponse.json(
      { error: "답변을 저장하지 못했어요." },
      { status: 500 }
    );
  }
}
