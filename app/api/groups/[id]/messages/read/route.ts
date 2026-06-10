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

  await prisma.message.updateMany({
    where: {
      groupId: id,
      senderId: { not: session.user.id },
      read: false,
    },
    data: { read: true },
  });

  return Response.json({ ok: true });
}
