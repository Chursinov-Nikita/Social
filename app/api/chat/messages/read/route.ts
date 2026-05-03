import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { senderId } = await req.json();

  await prisma.message.updateMany({
    where: { senderId, receiverId: session.user.id, read: false },
    data: { read: true },
  });

  return Response.json({ ok: true });
}
