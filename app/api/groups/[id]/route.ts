import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const group = await prisma.groupChat.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!group)
    return Response.json({ error: "Group not found" }, { status: 404 });

  return Response.json(group);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, avatar } = await req.json();

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });

  if (member?.role !== "owner")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const group = await prisma.groupChat.update({
    where: { id },
    data: { ...(name && { name }), ...(avatar && { avatar }) },
  });

  return Response.json(group);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });

  if (member?.role !== "owner")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  await prisma.groupChat.delete({ where: { id } });

  return Response.json({ ok: true });
}
