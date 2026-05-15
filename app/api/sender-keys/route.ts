import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Получить зашифрованный Sender Key
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const senderId = new URL(req.url).searchParams.get("senderId");
  if (!senderId)
    return Response.json({ error: "No senderId" }, { status: 400 });

  const senderKey = await prisma.senderKey.findUnique({
    where: { senderId_recipientId: { senderId, recipientId: session.user.id } },
  });

  return Response.json({ encryptedKey: senderKey?.encryptedKey ?? null });
}

// Сохранить зашифрованный Sender Key для получателя
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { recipientId, encryptedKey } = await req.json();

  await prisma.senderKey.upsert({
    where: { senderId_recipientId: { senderId: session.user.id, recipientId } },
    create: { senderId: session.user.id, recipientId, encryptedKey },
    update: { encryptedKey },
  });

  return Response.json({ ok: true });
}
