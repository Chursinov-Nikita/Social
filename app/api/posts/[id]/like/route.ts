import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId: id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return Response.json({ liked: false });
  }

  await prisma.like.create({
    data: { postId: id, userId: session.user.id },
  });

  // Уведомление автору поста
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (post && post.authorId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: "like",
        content: `${session.user.name ?? "Кто-то"} лайкнул ваш пост`,
        senderId: session.user.id,
      },
    });
  }

  return Response.json({ liked: true });
}
