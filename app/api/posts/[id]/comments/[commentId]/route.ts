// app/api/posts/[id]/comments/[commentId]/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await params;

  await prisma.comment.delete({
    where: { id: commentId, authorId: session.user.id },
  });

  return Response.json({ ok: true });
}
