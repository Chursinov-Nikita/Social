import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({});

  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
    },
    orderBy: { createdAt: "desc" },
  });

  const previews: Record<
    string,
    {
      content: string;
      createdAt: string;
      senderId: string;
      receiverId: string;
      read: boolean;
    }
  > = {};
  const unread: Record<string, number> = {};

  for (const msg of messages) {
    const companionId =
      msg.senderId === session.user.id ? msg.receiverId : msg.senderId;
    if (!previews[companionId]) {
      previews[companionId] = {
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        read: msg.read,
      };
    }
    if (msg.receiverId === session.user.id && !msg.read) {
      unread[companionId] = (unread[companionId] ?? 0) + 1;
    }
  }

  return Response.json({ previews, unread });
}
