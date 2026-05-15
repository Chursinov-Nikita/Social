// app/api/sender-keys/own/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Получить свой зашифрованный Sender Key (бэкап)
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const senderKey = await prisma.senderKey.findUnique({
    where: {
      senderId_recipientId: {
        senderId: session.user.id,
        recipientId: session.user.id,
      },
    },
  });

  return Response.json({ encryptedKey: senderKey?.encryptedKey ?? null });
}

// Сохранить свой Sender Key зашифрованным своим RSA (бэкап)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { encryptedKey } = await req.json();
  if (!encryptedKey)
    return Response.json({ error: "No encryptedKey" }, { status: 400 });

  await prisma.senderKey.upsert({
    where: {
      senderId_recipientId: {
        senderId: session.user.id,
        recipientId: session.user.id,
      },
    },
    create: {
      senderId: session.user.id,
      recipientId: session.user.id,
      encryptedKey,
    },
    update: { encryptedKey },
  });

  return Response.json({ ok: true });
}
