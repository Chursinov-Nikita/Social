import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { companionId } = await req.json();

  const existing = await prisma.chatFolderMember.findFirst({
    where: { folderId: id, companionId },
  });

  if (existing) {
    await prisma.chatFolderMember.delete({ where: { id: existing.id } });
    return Response.json({ added: false });
  }

  await prisma.chatFolderMember.create({ data: { folderId: id, companionId } });
  return Response.json({ added: true });
}
