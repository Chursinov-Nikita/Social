import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.chatFolder.delete({ where: { id, userId: session.user.id } });
  return Response.json({ ok: true });
}
