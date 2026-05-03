import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const reels = await prisma.reel.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      author: { select: { id: true, name: true, image: true } },
      likes: { select: { userId: true } },
      _count: { select: { comments: true } },
    },
  });

  return Response.json(
    reels.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { url1080p, thumbnail } = await req.json();
  if (!url1080p) return Response.json({ error: "No video" }, { status: 400 });

  const reel = await prisma.reel.create({
    data: {
      url1080p,
      thumbnail,
      authorId: session.user.id,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      likes: { select: { userId: true } },
    },
  });

  return Response.json({ ...reel, createdAt: reel.createdAt.toISOString() });
}
