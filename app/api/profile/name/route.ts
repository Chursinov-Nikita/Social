import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim())
    return Response.json({ error: "Пустое имя" }, { status: 400 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  });

  return Response.json({ ok: true });
}
