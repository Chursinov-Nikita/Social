import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { recipientId, mode } = await req.json();

  if (mode === "mine") {
    // Только мои сообщения
    await prisma.message.deleteMany({
      where: { senderId: session.user.id, receiverId: recipientId },
    });
  } else if (mode === "all") {
    // Все сообщения в чате
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: recipientId },
          { senderId: recipientId, receiverId: session.user.id },
        ],
      },
    });
  }

  return Response.json({ ok: true });
}
