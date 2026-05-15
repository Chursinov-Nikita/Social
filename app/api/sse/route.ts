import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          closed = true;
        }
      };

      const [messages, notifications] = await Promise.all([
        prisma.message.count({ where: { receiverId: userId, read: false } }),
        prisma.notification.count({ where: { userId, read: false } }),
      ]);
      send({ messages, notifications });

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        try {
          const [messages, notifications] = await Promise.all([
            prisma.message.count({
              where: { receiverId: userId, read: false },
            }),
            prisma.notification.count({ where: { userId, read: false } }),
          ]);
          send({ messages, notifications });
        } catch {
          clearInterval(interval);
          closed = true;
        }
      }, 2000);

      return () => {
        closed = true;
        clearInterval(interval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
