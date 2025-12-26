import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDefaultUser } from "@/lib/user";

const GRID_SIZE = 64;

export async function GET() {
  try {
    const user = await getDefaultUser();

    // 1. Daily Reward Check
    const now = new Date();
    const lastReward = user.lastRewardDate
      ? new Date(user.lastRewardDate)
      : null;
    let newTiles: { type: string; count: number }[] = [];

    // Check if it's a different day (simple check: different date string)
    const isToday =
      lastReward && lastReward.toDateString() === now.toDateString();

    if (!isToday) {
      // Grant 4 random tiles
      const tileTypes = ["wood", "water", "sand"];
      const rewardTiles = [];
      for (let i = 0; i < 4; i++) {
        rewardTiles.push(
          tileTypes[Math.floor(Math.random() * tileTypes.length)]
        );
      }

      // Update DB
      await prisma.$transaction(async (tx) => {
        // Update user last reward date
        await tx.user.update({
          where: { id: user.id },
          data: { lastRewardDate: now },
        });

        // Add tiles
        for (const type of rewardTiles) {
          await tx.userTile.upsert({
            where: { userId_type: { userId: user.id, type } },
            update: { count: { increment: 1 } },
            create: { userId: user.id, type, count: 1 },
          });
        }
      });
      newTiles = rewardTiles.map((t) => ({ type: t, count: 1 })); // Just for notification
    }

    // 2. Fetch Data
    const scores = await prisma.userCategoryScore.findMany({
      where: { userId: user.id },
    });

    // Snap existing trees to grid on fetch (Migration logic on-the-fly)
    let trees = await prisma.plantedTree.findMany({
      where: { userId: user.id },
    });

    // Check if any tree is off-grid and fix it (Simple auto-migration)
    const updates = [];
    for (const tree of trees) {
      const snappedX = Math.round(tree.x / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(tree.y / GRID_SIZE) * GRID_SIZE;
      if (
        Math.abs(tree.x - snappedX) > 0.1 ||
        Math.abs(tree.y - snappedY) > 0.1
      ) {
        updates.push(
          prisma.plantedTree.update({
            where: { id: tree.id },
            data: { x: snappedX, y: snappedY },
          })
        );
      }
    }
    if (updates.length > 0) {
      await prisma.$transaction(updates);
      // Re-fetch updated trees
      trees = await prisma.plantedTree.findMany({ where: { userId: user.id } });
    }

    const tiles = await prisma.userTile.findMany({
      where: { userId: user.id },
    });

    const placedTiles = await prisma.placedTile.findMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      scores,
      trees,
      tiles,
      placedTiles,
      newRewards: newTiles.length > 0 ? newTiles : null,
    });
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
    const { action, category, type, x, y } = body; // action='plant_tree' or 'place_tile'

    // Snap coordinates to grid
    const gridX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.round(y / GRID_SIZE) * GRID_SIZE;

    if (action === "plant_tree") {
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

      // 2. Plan Tree
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
            x: gridX,
            y: gridY,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        tree: result[1],
        newScore: result[0],
      });
    } else if (action === "debug_add") {
      // Cheat code: Add score or tiles
      // body: { action: 'debug_add', category?: string, type?: string, amount: number }
      const { amount } = body;

      if (category) {
        // Add Score
        await prisma.userCategoryScore.upsert({
          where: { userId_category: { userId: user.id, category } },
          update: { score: { increment: amount } },
          create: { userId: user.id, category, score: amount },
        });
      } else if (type) {
        // Add Tile
        await prisma.userTile.upsert({
          where: { userId_type: { userId: user.id, type } },
          update: { count: { increment: amount } },
          create: { userId: user.id, type, count: amount },
        });
      }
      return NextResponse.json({ success: true });
    } else if (action === "place_tile") {
      // 1. Check inventory
      const userTile = await prisma.userTile.findUnique({
        where: { userId_type: { userId: user.id, type } },
      });

      if (!userTile || userTile.count < 1) {
        return NextResponse.json(
          { error: "No tile available" },
          { status: 400 }
        );
      }

      // 2. Place Tile & Decrement Inventory
      const result = await prisma.$transaction([
        prisma.userTile.update({
          where: { userId_type: { userId: user.id, type } },
          data: { count: { decrement: 1 } },
        }),
        prisma.placedTile.create({
          data: {
            userId: user.id,
            type,
            x: gridX,
            y: gridY,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        tile: result[1],
        newInventory: result[0],
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
