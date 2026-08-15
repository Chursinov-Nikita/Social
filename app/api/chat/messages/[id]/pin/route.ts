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

  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      pinned: true,
    },
  });

  if (!message) return Response.json({ error: "Not found" }, { status: 404 });

  if (
    message.senderId !== session.user.id &&
    message.receiverId !== session.user.id
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.message.update({
    where: { id },
    data: {
      pinned: !message.pinned,
      pinnedAt: !message.pinned ? new Date() : null,
    },
  });

  return Response.json({ success: true, pinned: updated.pinned });
}
