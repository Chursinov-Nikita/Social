"use client";
import { useAuth } from "@/app/context/auth";
import { useLang } from "@/app/context/language";
import { createClient } from "@/app/lib/supabase/client";
import { t } from "@/app/translation/translation";
import type { Post as PostType } from "@/app/types/feed";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import CreatePost from "./CreatePost";
import Post from "./Post";

const PAGE_SIZE = 10;
const FEED_CACHE_KEY = "feed-cache-v1";
const FEED_CACHE_TTL_MS = 60_000;

const mergeUniquePosts = (current: PostType[], incoming: PostType[]) => {
  const seenIds = new Set(current.map((post) => post.id));
  return [...current, ...incoming.filter((post) => !seenIds.has(post.id))];
};

const getInitialFeedState = (initialPosts: PostType[]) => {
  const fallback = {
    posts: initialPosts,
    page: 1,
    hasMore: initialPosts.length === PAGE_SIZE,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const rawCache = sessionStorage.getItem(FEED_CACHE_KEY);
    if (!rawCache) return fallback;
    const parsed = JSON.parse(rawCache) as {
      posts: PostType[];
      page: number;
      hasMore: boolean;
      timestamp: number;
    };
    if (Date.now() - parsed.timestamp >= FEED_CACHE_TTL_MS) return fallback;
    return { posts: parsed.posts, page: parsed.page, hasMore: parsed.hasMore };
  } catch {
    sessionStorage.removeItem(FEED_CACHE_KEY);
    return fallback;
  }
};

const Feed = ({ initialPosts }: { initialPosts: PostType[] }) => {
  const [initialFeedState] = useState(() => getInitialFeedState(initialPosts));
  const [posts, setPosts] = useState<PostType[]>(initialFeedState.posts);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialFeedState.page);
  const [hasMore, setHasMore] = useState(initialFeedState.hasMore);
  const { user } = useAuth();
  const { lang } = useLang();
  const tr = t[lang];
  const currentUserId = user?.id ?? null;
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FEED_CACHE_KEY,
        JSON.stringify({ posts, page, hasMore, timestamp: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }, [posts, page, hasMore]);

  useEffect(() => {
    const channelPromise = supabase
      .channel("posts-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload: RealtimePostgresChangesPayload<PostType>) => {
          const newPost = payload.new as PostType;
          if (newPost.user_id !== currentUserId)
            setPosts((prev) => mergeUniquePosts([newPost], prev));
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

    return () => {
      supabase.removeChannel(channelPromise);
    };
  }, [supabase, currentUserId]);

  const loadMorePosts = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const from = page * PAGE_SIZE;
    const { data: newPosts, error } = (await supabase
      .from("posts")
      .select(
        "id, user_id, content, image_url, likes_count, comments_count, created_at, profiles (username, avatar_url), likes (user_id)",
      )
      .order("created_at", { ascending: false })
      .range(from, from + 9)) as { data: PostType[] | null; error: unknown };

    if (!error && newPosts && newPosts.length > 0) {
      setPosts((prev) => mergeUniquePosts(prev, newPosts));
      setPage((prev) => prev + 1);
      if (newPosts.length < PAGE_SIZE) setHasMore(false);
    } else if (!error) {
      setHasMore(false);
    }
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
          <Post
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            initialLiked={
              post.likes?.some(
                (l: { user_id: string }) => l.user_id === currentUserId,
              ) ?? false
            }
            onLikeChange={(delta) => {
              setPosts((prev) =>
                prev.map((p) => {
                  if (p.id !== post.id) return p;
                  const liked = delta > 0;
                  const updatedLikes = liked
                    ? [...(p.likes ?? []), { user_id: currentUserId! }]
                    : (p.likes ?? []).filter(
                        (l) => l.user_id !== currentUserId,
                      );
                  return {
                    ...p,
                    likes_count: Math.max((p.likes_count ?? 0) + delta, 0),
                    likes: updatedLikes,
                  };
                }),
              );
            }}
          />
        ))}

        <button
          onClick={loadMorePosts}
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
              {tr.loadingDots}
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
