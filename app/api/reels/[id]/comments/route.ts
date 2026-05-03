import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comments = await prisma.comment.findMany({
    where: { reelId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return Response.json(
    comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();
  if (!content?.trim())
    return Response.json({ error: "Empty" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: { content, reelId: id, authorId: session.user.id },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  return Response.json({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  });
}
