import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get("recipientId");
  const cursor = searchParams.get("cursor");
  if (!recipientId) return Response.json([], { status: 400 });

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: session.user.id, receiverId: recipientId },
        { senderId: recipientId, receiverId: session.user.id },
      ],
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  return Response.json(
    messages.reverse().map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId, content } = await req.json();
  if (!receiverId || !content?.trim())
    return Response.json({ error: "Invalid" }, { status: 400 });

  const message = await prisma.message.create({
    data: { senderId: session.user.id, receiverId, content: content.trim() },
  });

  return Response.json({
    ...message,
    createdAt: message.createdAt.toISOString(),
  });
}
