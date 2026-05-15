import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UserProfile from "@/app/components/profile/[id]/UserProfile";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) notFound();

  const [postsCount, reelsCount] = await Promise.all([
    prisma.post.count({ where: { authorId: id } }),
    prisma.reel.count({ where: { authorId: id } }),
  ]);

  return (
    <UserProfile
      user={{
        ...user,
        createdAt: user.createdAt.toISOString(),
        _count: { posts: postsCount, reels: reelsCount },
      }}
    />
  );
}
