import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

export async function GET() {
  try {
    const user = await getDefaultUser();

    // Fetch all scores
    const scores = await prisma.userCategoryScore.findMany({
      where: { userId: user.id },
    });

    // Fetch planted trees
    const trees = await prisma.plantedTree.findMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ scores, trees });
  } catch (error) {
    console.error("[Forest] GET failed", error);
    return NextResponse.json(
      { error: "Failed to load forest" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getDefaultUser();
    const body = await request.json();
    const { action, category, x, y } = body;

    if (action === "plant") {
      // 1. Check if user has enough score (>= 6)
      const userScore = await prisma.userCategoryScore.findUnique({
        where: {
          userId_category: {
            userId: user.id,
            category: category,
          },
        },
      });

      if (!userScore || userScore.score < 6) {
        return NextResponse.json(
          { error: "Not enough growth points to plant a tree" },
          { status: 400 }
        );
      }

      // 2. Transact: Deduct 6 points & Plan Tree
      const result = await prisma.$transaction([
        prisma.userCategoryScore.update({
          where: {
            userId_category: {
              userId: user.id,
              category: category,
            },
          },
          data: { score: { decrement: 6 } },
        }),
        prisma.plantedTree.create({
          data: {
            userId: user.id,
            category: category,
            x: x,
            y: y,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        tree: result[1],
        newScore: result[0],
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Forest] POST failed", error);
    return NextResponse.json(
      { error: "Forest action failed" },
      { status: 500 }
    );
  }
}
