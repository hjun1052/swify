import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";
import { getTodayRange } from "@/lib/date";

interface CategorySummary {
  category: string;
  count: number;
}

function normalizeCategory(category?: string) {
  if (!category) return "LEARN";
  return category.toUpperCase();
}

export async function GET() {
  try {
    const user = await getDefaultUser();
    const { start, end } = getTodayRange();

    const entries = await prisma.watchHistory.findMany({
      where: {
        userId: user.id,
        watchedAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { watchedAt: "desc" },
    });

    const categorySummary = entries.reduce<Record<string, number>>((acc, entry) => {
      const cat = entry.category;
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const categories: CategorySummary[] = Object.entries(categorySummary).map(
      ([category, count]) => ({ category, count })
    );

    const dailyReflection = await prisma.dailyReflection.findFirst({
      where: {
        userId: user.id,
        reflectionDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const reflection = dailyReflection
      ? {
          ...dailyReflection,
          summaryPayload: safeParseSummary(dailyReflection.summary),
        }
      : null;

    return NextResponse.json({
      entries,
      categories,
      titles: entries.map((entry) => entry.title),
      reflection,
    });
  } catch (error) {
    console.error("[History] GET failed", error);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

function safeParseSummary(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, title, category, style } = body || {};

    if (!videoId || !title) {
      return NextResponse.json(
        { error: "videoId and title are required" },
        { status: 400 }
      );
    }

    const normalizedCategory = normalizeCategory(category);
    const user = await getDefaultUser();
    const { start, end } = getTodayRange();

    const existing = await prisma.watchHistory.findFirst({
      where: {
        userId: user.id,
        videoId,
        watchedAt: {
          gte: start,
          lte: end,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ entry: existing, duplicate: true });
    }

    const entry = await prisma.watchHistory.create({
      data: {
        videoId,
        title,
        category: normalizedCategory,
        style,
        userId: user.id,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("[History] POST failed", error);
    return NextResponse.json({ error: "Failed to log history" }, { status: 500 });
  }
}
