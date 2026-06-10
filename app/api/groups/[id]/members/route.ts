import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userId } = await req.json();

  const me = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });
  if (me?.role !== "owner")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const member = await prisma.groupMember.create({
    data: { groupId: id, userId, role: "member" },
    include: { user: true },
  });

  return Response.json(member);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userId } = await req.json();

  const me = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: session.user.id } },
  });

  // owner удаляет кого угодно, участник только себя
  if (me?.role !== "owner" && userId !== session.user.id)
    return Response.json({ error: "Forbidden" }, { status: 403 });

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId: id, userId } },
  });

  return Response.json({ ok: true });
}
