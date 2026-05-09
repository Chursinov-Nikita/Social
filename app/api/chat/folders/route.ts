import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json([]);

  const folders = await prisma.chatFolder.findMany({
    where: { userId: session.user.id },
    orderBy: { position: "asc" },
    include: { members: true },
  });

  return Response.json(folders);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim())
    return Response.json({ error: "No name" }, { status: 400 });

  const count = await prisma.chatFolder.count({
    where: { userId: session.user.id },
  });

  const folder = await prisma.chatFolder.create({
    data: { userId: session.user.id, name: name.trim(), position: count },
    include: { members: true },
  });

  return Response.json(folder);
}
