import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json([]);

  const friendships = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
    },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  return Response.json(friendships);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId } = await req.json();

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: session.user.id, receiverId },
        { senderId: receiverId, receiverId: session.user.id },
      ],
    },
  });

  if (existing) return Response.json(existing);

  const friendship = await prisma.friendship.create({
    data: { senderId: session.user.id, receiverId, status: "pending" },
  });

  // Уведомление получателю заявки
  await prisma.notification.create({
    data: {
      userId: receiverId,
      type: "friend_request",
      content: `${session.user.name ?? "Кто-то"} отправил вам заявку в друзья`,
      senderId: session.user.id,
    },
  });

  return Response.json(friendship);
}
