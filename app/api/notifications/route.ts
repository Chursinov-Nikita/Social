import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json([]);

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const senderIds = [
    ...new Set(
      notifications.map((n) => n.senderId).filter(Boolean) as string[],
    ),
  ];

  const senders = senderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, name: true, image: true },
      })
    : [];

  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const friendRequestSenderIds = notifications
    .filter((n) => n.type === "friend_request" && n.senderId)
    .map((n) => n.senderId as string);

  const activeFriendships = friendRequestSenderIds.length
    ? await prisma.friendship.findMany({
        where: {
          senderId: { in: friendRequestSenderIds },
          receiverId: session.user.id,
          status: "pending",
        },
        select: { id: true, senderId: true },
      })
    : [];

  const activeSenderMap = new Map(
    activeFriendships.map((f) => [f.senderId, f.id]),
  );

  return Response.json(
    notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      sender: n.senderId ? (senderMap.get(n.senderId) ?? null) : null,
      friendshipId:
        n.type === "friend_request" && n.senderId
          ? (activeSenderMap.get(n.senderId) ?? null)
          : null,
    })),
  );
}
