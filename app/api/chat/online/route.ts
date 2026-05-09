import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const ONLINE_THRESHOLD = 30000;

export async function GET(req: NextRequest) {
  const ids =
    new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (!ids.length) return Response.json({});

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, lastSeen: true },
  });

  const now = Date.now();
  const result: Record<string, { online: boolean; lastSeen: string | null }> =
    {};

  for (const user of users) {
    const lastPing = user.lastSeen?.getTime() ?? 0;
    result[user.id] = {
      online: now - lastPing < ONLINE_THRESHOLD,
      lastSeen: user.lastSeen?.toISOString() ?? null,
    };
  }

  return Response.json(result);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastSeen: new Date() },
  });

  return Response.json({ ok: true });
}
