"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/app/lib/supabase/client";
import Post from "./Post";
import CreatePost from "./CreatePost";
import type { Post as PostType } from "@/app/types/feed";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useAuth } from "@/app/context/auth";

const Feed = ({ initialPosts }: { initialPosts: PostType[] }) => {
  const [posts, setPosts] = useState<PostType[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const supabase = createClient();

  useEffect(() => {
    const setupRealtime = async () => {
      const channel = supabase
        .channel("posts-channel")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "posts" },
          (payload: RealtimePostgresChangesPayload<PostType>) => {
            const newPost = payload.new as PostType;
            if (newPost.user_id !== currentUserId) {
              setPosts((prev) => [newPost, ...prev]);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "posts" },
          (payload: RealtimePostgresChangesPayload<PostType>) => {
            const oldPost = payload.old as Partial<PostType>;
            setPosts((prev) => prev.filter((post) => post.id !== oldPost.id));
          },
        )
        .subscribe();
      return channel;
    };

    const channelPromise = setupRealtime();
    return () => {
      channelPromise.then((channel) => supabase.removeChannel(channel));
    };
  }, [supabase, currentUserId]);

  const loadMorePosts = async () => {
    setLoading(true);
    const from = page * 10;
    const to = from + 9;

    const { data: newPosts, error } = (await supabase
      .from("posts")
      .select(`*, profiles (username, avatar_url), likes (user_id)`)
      .order("created_at", { ascending: false })
      .range(from, to)) as { data: PostType[] | null; error: unknown };

    if (!error && newPosts) {
      setPosts((prev) => [...prev, ...newPosts]);
      setPage((prev) => prev + 1);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-white">Feed</h1>
          <p className="text-white/40 text-sm mt-0.5">
            What&apos;s happening right now
          </p>
        </div>

        <CreatePost
          onPostCreated={(newPost) => setPosts((prev) => [newPost, ...prev])}
        />

        {posts.map((post) => (
          <Post
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            initialLiked={
              post.likes?.some(
                (l: { user_id: string }) => l.user_id === currentUserId,
              ) ?? false
            }
          />
        ))}

        <button
          onClick={loadMorePosts}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm text-white/40 hover:text-white hover:bg-[#2c2c2e] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
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
              Loading...
            </span>
          ) : (
            "Load more"
          )}
        </button>
      </div>
    </div>
  );
};

export default Feed;
