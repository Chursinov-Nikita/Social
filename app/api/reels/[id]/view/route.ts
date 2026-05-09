import { prisma } from "@/lib/prisma";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.reel.update({
    where: { id },
    data: { views: { increment: 1 } },
  });
  return Response.json({ ok: true });
}
