import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json([]);

  const requests = await prisma.friendship.findMany({
    where: { receiverId: session.user.id, status: "pending" },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  return Response.json(requests);
}
