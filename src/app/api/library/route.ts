import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { VideoShort } from "../generate/route";
import { getDefaultUser } from "@/lib/user";

export async function GET() {
  try {
    const user = await getDefaultUser();
    const savedVideos = await prisma.savedVideo.findMany({
      where: { userId: user.id },
      include: { slides: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(savedVideos);
  } catch (error) {
    console.error("Library GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch library" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getDefaultUser();
    const video: VideoShort = await req.json();

    if (!video.id || !video.slides) {
      return NextResponse.json(
        { error: "Invalid video data" },
        { status: 400 }
      );
    }

    const savedVideo = await prisma.savedVideo.upsert({
      where: { id: video.id },
      update: {
        title: video.title,
        creator: video.creator,
        voice: video.voice,
        bgmIndex: video.bgmIndex,
        slides: {
          deleteMany: {},
          create: video.slides.map((s, i) => ({
            text: s.text,
            imageQuery: s.imageQuery,
            imageUrl: s.imageUrl,
            audioUrl: s.audioUrl,
            order: i,
          })),
        },
      },
      create: {
        id: video.id,
        title: video.title,
        creator: video.creator,
        voice: video.voice,
        bgmIndex: video.bgmIndex,
        userId: user.id,
        slides: {
          create: video.slides.map((s, i) => ({
            text: s.text,
            imageQuery: s.imageQuery,
            imageUrl: s.imageUrl,
            audioUrl: s.audioUrl,
            order: i,
          })),
        },
      },
      include: { slides: true },
    });

    return NextResponse.json(savedVideo);
  } catch (error) {
    console.error("Library POST error:", error);
    return NextResponse.json(
      { error: "Failed to save video" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.savedVideo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Library DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
