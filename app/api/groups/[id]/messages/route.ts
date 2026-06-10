import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 30;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "asc" },
    take: PAGE_SIZE,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: { sender: true },
  });

  return Response.json(messages);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content, type = "text" } = await req.json();

  if (!content?.trim())
    return Response.json({ error: "No content" }, { status: 400 });

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

  const message = await prisma.message.create({
    data: {
      content,
      type,
      senderId: session.user.id,
      groupId: id,
    },
    include: { sender: true },
  });

  return Response.json(message);
}
