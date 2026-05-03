import { prisma } from "@/lib/prisma";
import type { Post } from "./types/feed";
import Feed from "./components/feed/Feed";

const PAGE_SIZE = 10;

export default async function Home() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: {
      author: { select: { id: true, name: true, image: true } },
      likes: { select: { userId: true } },
      _count: { select: { comments: true } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safePosts: Post[] = (posts as any[]).map((p) => ({
    id: p.id,
    content: p.content,
    imageUrl: p.imageUrl,
    authorId: p.authorId,
    createdAt: p.createdAt.toISOString(),
    author: p.author,
    likes: p.likes ?? [],
    _count: p._count,
  }));

  return (
    <main>
      <Feed initialPosts={safePosts} />
    </main>
  );
}
