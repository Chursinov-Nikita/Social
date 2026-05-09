"use client";
import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { Post } from "@/app/types/feed";
import { useState } from "react";
import CreatePost from "./CreatePost";
import PostCard from "./Post";
import Loading from "../loading/Loading";

const PAGE_SIZE = 10;

const Feed = ({ initialPosts = [] }: { initialPosts: Post[] }) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];
  const currentUserId = session?.user?.id ?? null;

  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length === PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const res = await fetch(`/api/posts?page=${page}`);
    const newPosts: Post[] = await res.json();
    setPosts((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...prev, ...newPosts.filter((p) => !ids.has(p.id))];
    });
    setPage((p) => p + 1);
    if (newPosts.length < PAGE_SIZE) setHasMore(false);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-(--bg-primary)">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-(--text-primary)">
            {tr.feed}
          </h1>
          <p className="text-(--text-primary)/40 text-sm mt-0.5">
            {tr.feedSubtitle}
          </p>
        </div>

        <CreatePost
          onPostCreated={(newPost) => setPosts((prev) => [newPost, ...prev])}
        />

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onPostDeleted={(id) =>
              setPosts((prev) => prev.filter((p) => p.id !== id))
            }
            onLikeChange={(id, liked) => {
              setPosts((prev) =>
                prev.map((p) => {
                  if (p.id !== id) return p;
                  return {
                    ...p,
                    likes: liked
                      ? [...p.likes, { userId: currentUserId! }]
                      : p.likes.filter((l) => l.userId !== currentUserId),
                  };
                }),
              );
            }}
          />
        ))}

        <button
          onClick={loadMore}
          disabled={loading || !hasMore}
          className="w-full py-2.5 rounded-xl text-sm text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-secondary) disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              <Loading />
            </span>
          ) : !hasMore ? (
            tr.noMorePosts
          ) : (
            tr.loadMore
          )}
        </button>
      </div>
    </div>
  );
};

export default Feed;
