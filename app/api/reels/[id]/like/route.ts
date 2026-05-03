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
    where: { reelId_userId: { reelId: id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return Response.json({ liked: false });
  }

  await prisma.like.create({ data: { reelId: id, userId: session.user.id } });

  const reel = await prisma.reel.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (reel && reel.authorId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: reel.authorId,
        type: "like",
        content: `${session.user.name ?? "Кто-то"} лайкнул ваш рилс`,
        senderId: session.user.id,
      },
    });
  }

  return Response.json({ liked: true });
}
