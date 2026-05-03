import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const friendship = await prisma.friendship.findFirst({
    where: { id, receiverId: session.user.id, status: "pending" },
  });

  if (!friendship)
    return Response.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: "accepted" },
  });

  return Response.json(updated);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const friendship = await prisma.friendship.findFirst({
    where: {
      id,
      OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
    },
  });

  if (!friendship)
    return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.friendship.delete({ where: { id } });

  return Response.json({ ok: true });
}
