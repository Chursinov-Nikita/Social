import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { publicKey } = await req.json();

  await prisma.userKey.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, publicKey },
    update: { publicKey },
  });

  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return Response.json({ error: "No userId" }, { status: 400 });

  const userKey = await prisma.userKey.findUnique({
    where: { userId },
    select: { publicKey: true },
  });

  return Response.json({ publicKey: userKey?.publicKey ?? null });
}
