import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json([]);

  const groups = await prisma.groupChat.findMany({
    where: {
      members: {
        some: { userId: session.user.id },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, avatar, memberIds } = await req.json();
  if (!name?.trim())
    return Response.json({ error: "No name" }, { status: 400 });

  const group = await prisma.groupChat.create({
    data: {
      name: name.trim(),
      avatar: avatar ?? null,
      createdBy: session.user.id,
      members: {
        create: [
          { userId: session.user.id, role: "owner" },
          ...(memberIds ?? []).map((id: string) => ({
            userId: id,
            role: "member",
          })),
        ],
      },
    },
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  return Response.json(group);
}
