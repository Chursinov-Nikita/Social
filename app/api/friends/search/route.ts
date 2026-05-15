import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) return Response.json([]);

  const userId = session.user.id;

  const query = new URL(req.url).searchParams.get("q") ?? "";
  if (!query.trim()) return Response.json([]);

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      name: { contains: query, mode: "insensitive" },
    },
    select: { id: true, name: true, image: true },
    take: 10,
  });

  const ids = users.map((u) => u.id);
  const relations = await prisma.friendship.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: { in: ids } },
        { senderId: { in: ids }, receiverId: userId },
      ],
    },
  });

  const relationMap = new Map(
    relations.map((r) => {
      const other = r.senderId === userId ? r.receiverId : r.senderId;
      return [other, r.status as "pending" | "accepted"];
    }),
  );

  return Response.json(
    users.map((u) => ({
      ...u,
      relationStatus: relationMap.get(u.id) ?? "none",
    })),
  );
}
