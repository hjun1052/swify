import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

export async function GET() {
  try {
    const user = await getDefaultUser();
    const reflections = await prisma.dailyReflection.findMany({
      where: { userId: user.id, answer: { not: null } },
      orderBy: { reflectionDate: "desc" },
    });

    const formatted = reflections.map((reflection) => ({
      id: reflection.id,
      question: reflection.question,
      answer: reflection.answer,
      reflectionDate: reflection.reflectionDate,
      summary: safeParse(reflection.summary),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[Reflections] GET failed", error);
    return NextResponse.json(
      { error: "Failed to load reflections" },
      { status: 500 }
    );
  }
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
