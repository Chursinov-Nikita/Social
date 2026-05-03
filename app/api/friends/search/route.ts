import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json([]);

  const query = new URL(req.url).searchParams.get("q") ?? "";
  if (!query.trim()) return Response.json([]);

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      name: { contains: query, mode: "insensitive" },
    },
    select: { id: true, name: true, image: true },
    take: 10,
  });

  const ids = users.map((u) => u.id);
  const relations = await prisma.friendship.findMany({
    where: {
      OR: [
        { senderId: session.user.id, receiverId: { in: ids } },
        { senderId: { in: ids }, receiverId: session.user.id },
      ],
    },
  });

  const relationMap = new Map(
    relations.map((r) => {
      const other = r.senderId === session.user.id ? r.receiverId : r.senderId;
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
