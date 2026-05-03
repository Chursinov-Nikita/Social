import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Сразу отправляем текущие счётчики
      const [messages, notifications] = await Promise.all([
        prisma.message.count({ where: { receiverId: userId, read: false } }),
        prisma.notification.count({ where: { userId, read: false } }),
      ]);
      send({ messages, notifications });

      // Проверяем каждые 2 секунды
      const interval = setInterval(async () => {
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
          controller.close();
        }
      }, 2000);

      // Закрываем при дисконнекте
      return () => clearInterval(interval);
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
