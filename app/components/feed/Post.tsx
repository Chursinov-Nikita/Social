"use client";
import { useLang } from "@/app/context/language";
import { createClient } from "@/app/lib/supabase/client";
import { t } from "@/app/translation/translation";
import type { Comment, PostProps } from "@/app/types/feed";
import {
  ChatBubbleLeftIcon,
  HeartIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const commentsCache = new Map<string, Comment[]>();

const Post = ({
  post,
  currentUserId,
  initialLiked,
  onLikeChange,
}: PostProps & { onLikeChange?: (delta: number) => void }) => {
  const supabase = useMemo(() => createClient(), []);
  const { lang } = useLang();
  const tr = t[lang];
  const [liked, setLiked] = useState<boolean>(initialLiked);
  const [likesCount, setLikesCount] = useState<number>(post.likes_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsCount, setCommentsCount] = useState(post.comments_count ?? 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const lastPostIdRef = useRef(post.id);
  const pendingOwnLike = useRef(false);
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    setLiked(initialLiked);
  }, [post.id, initialLiked]);

  useEffect(() => {
    if (lastPostIdRef.current === post.id) return;
    lastPostIdRef.current = post.id;
    setLiked(initialLiked);
    setLikesCount(post.likes_count ?? 0);
    setCommentsCount(post.comments_count ?? 0);
    setComments(commentsCache.get(post.id) ?? []);
    setShowComments(false);
  }, [post.id, post.likes_count, post.comments_count, initialLiked]);

  const loadComments = useCallback(
    async (forceRefresh = false) => {
      const cachedComments = commentsCache.get(post.id);
      if (cachedComments && !forceRefresh) {
        setComments(cachedComments);
        setCommentsCount(cachedComments.length);
        return;
      }
      if (!cachedComments) setLoadingComments(true);
      const { data } = (await supabase
        .from("comments")
        .select(
          "id, post_id, user_id, content, created_at, profiles:user_id (username, avatar_url)",
        )
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })) as {
        data: Comment[] | null;
      };
      if (data) {
        commentsCache.set(post.id, data);
        setComments(data);
        setCommentsCount(data.length);
      }
      setLoadingComments(false);
    },
    [post.id, supabase],
  );

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Realtime — комментарии
  useEffect(() => {
    if (!showComments) return;
    const channel = supabase
      .channel(`comments-${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${post.id}`,
        },
        async (payload: RealtimePostgresChangesPayload<Comment>) => {
          const id = (payload.new as Partial<Comment>).id;
          if (!id) return;
          const { data } = (await supabase
            .from("comments")
            .select(
              "id, post_id, user_id, content, created_at, profiles:user_id (username, avatar_url)",
            )
            .eq("id", id)
            .single()) as { data: Comment | null };
          if (!data) return;
          setComments((prev) => {
            if (prev.some((c) => c.id === data.id)) return prev;
            const next = [...prev, data];
            commentsCache.set(post.id, next);
            setCommentsCount(next.length);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${post.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Comment>) => {
          const deletedId = (payload.old as Partial<Comment>).id;
          if (!deletedId) return;
          setComments((prev) => {
            const next = prev.filter((c) => c.id !== deletedId);
            commentsCache.set(post.id, next);
            setCommentsCount(next.length);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, showComments, supabase]);

  // Realtime — лайки от других пользователей
  useEffect(() => {
    const channel = supabase
      .channel(`likes-${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "likes",
          filter: `post_id=eq.${post.id}`,
        },
        (
          payload: RealtimePostgresChangesPayload<{
            user_id: string;
            post_id: string;
          }>,
        ) => {
          const newLike = payload.new as { user_id: string };
          // Используем реф вместо замыкания — всегда актуальный currentUserId
          if (
            newLike.user_id === currentUserIdRef.current ||
            pendingOwnLike.current
          )
            return;
          setLikesCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "likes",
          filter: `post_id=eq.${post.id}`,
        },
        (
          payload: RealtimePostgresChangesPayload<{
            user_id: string;
            post_id: string;
          }>,
        ) => {
          const oldLike = payload.old as { user_id?: string };
          if (
            oldLike.user_id === currentUserIdRef.current ||
            pendingOwnLike.current
          )
            return;
          setLikesCount((prev) => Math.max(prev - 1, 0));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Убрали currentUserId из deps — используем реф, канал не пересоздаётся
  }, [post.id, supabase]);

  const handleLike = async () => {
    if (!currentUserId || isLiking) return;
    setIsLiking(true);
    pendingOwnLike.current = true;

    const previousLiked = liked;
    const previousCount = likesCount;
    const newLiked = !liked;

    setLiked(newLiked);
    setLikesCount(
      newLiked ? previousCount + 1 : Math.max(previousCount - 1, 0),
    );

    try {
      if (newLiked) {
        const { error } = await supabase
          .from("likes")
          .upsert(
            { post_id: post.id, user_id: currentUserId },
            { onConflict: "post_id,user_id", ignoreDuplicates: true },
          );
        if (error) {
          setLiked(previousLiked);
          setLikesCount(previousCount);
        } else {
          onLikeChange?.(1);
        }
      } else {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        if (error) {
          setLiked(previousLiked);
          setLikesCount(previousCount);
        } else {
          onLikeChange?.(-1);
        }
      }
    } finally {
      setIsLiking(false);
      setTimeout(() => {
        pendingOwnLike.current = false;
      }, 500);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    setLoadingComment(true);
    const optimisticComment: Comment = {
      id: crypto.randomUUID(),
      post_id: post.id,
      user_id: currentUserId,
      content: commentText.trim(),
      created_at: new Date().toISOString(),
      profiles: { username: "Вы", avatar_url: null },
    };
    setComments((prev) => {
      const next = [...prev, optimisticComment];
      commentsCache.set(post.id, next);
      return next;
    });
    setCommentsCount((prev) => prev + 1);
    setCommentText("");
    const { data: savedComment, error } = (await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        user_id: currentUserId,
        content: optimisticComment.content,
      })
      .select(
        "id, post_id, user_id, content, created_at, profiles:user_id (username, avatar_url)",
      )
      .single()) as { data: Comment | null; error: unknown };
    if (error) {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== optimisticComment.id);
        commentsCache.set(post.id, next);
        setCommentsCount(next.length);
        return next;
      });
      setCommentText(optimisticComment.content);
    } else if (savedComment) {
      setComments((prev) => {
        const next = prev.map((c) =>
          c.id === optimisticComment.id ? savedComment : c,
        );
        commentsCache.set(post.id, next);
        return next;
      });
    }
    setLoadingComment(false);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== commentToDelete);
      commentsCache.set(post.id, next);
      setCommentsCount(next.length);
      return next;
    });
    await supabase.from("comments").delete().eq("id", commentToDelete);
    setCommentToDelete(null);
  };

  const username = post.profiles?.username ?? "Аноним";
  const avatarUrl = post.profiles?.avatar_url ?? null;

  return (
    <div className="rounded-xl bg-(--bg-secondary) overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center space-x-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            width={40}
            height={40}
            className="rounded-full object-cover w-10 h-10"
            alt={`Аватар ${username}`}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold text-(--text-primary) shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-sm text-(--text-primary)">
          {username}
        </span>
      </div>

      {post.image_url && (
        <div className="relative w-full aspect-video">
          <Image
            src={post.image_url}
            fill
            className="object-cover px-4"
            alt={
              post.content
                ? `Фото к посту: ${post.content.slice(0, 50)}`
                : "Изображение поста"
            }
          />
        </div>
      )}

      <div className="px-4 pb-4 pt-2 space-y-3">
        {post.content && (
          <p className="text-sm text-(--text-primary)/80 leading-relaxed">
            {post.content}
          </p>
        )}

        <div className="h-px bg-(--border)" />

        <div className="flex space-x-4">
          <button
            onClick={handleLike}
            disabled={!currentUserId}
            className={`flex items-center space-x-1.5 text-sm transition-all duration-200 disabled:opacity-30 ${
              liked
                ? "text-red-400"
                : "text-(--text-primary)/30 hover:text-red-400"
            }`}
          >
            {liked ? (
              <HeartSolidIcon className="w-5 h-5" />
            ) : (
              <HeartIcon className="w-5 h-5" />
            )}
            <span suppressHydrationWarning>{likesCount}</span>
          </button>

          <button
            onClick={() => setShowComments((prev) => !prev)}
            className={`flex items-center space-x-1.5 text-sm transition-colors duration-200 ${
              showComments
                ? "text-(--text-primary)/60"
                : "text-(--text-primary)/30 hover:text-(--text-primary)/60"
            }`}
          >
            <ChatBubbleLeftIcon className="w-5 h-5" />
            <span suppressHydrationWarning>{commentsCount}</span>
          </button>
        </div>

        {showComments && (
          <div className="space-y-3 pt-1">
            <div className="h-px bg-(--border)" />
            <div className="space-y-3 max-h-48 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {loadingComments ? (
                <p className="text-xs text-(--text-primary)/20 text-center py-2">
                  {tr.loadingComments}
                </p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-(--text-primary)/20 text-center py-2">
                  {tr.noCommentsYet}
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-(--bg-card) flex items-center justify-center text-xs font-bold text-(--text-primary) shrink-0">
                      {comment.profiles?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-(--text-primary)/70 mr-1">
                        {comment.profiles?.username}
                      </span>
                      <p className="text-xs text-(--text-primary)/50 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                    {comment.user_id === currentUserId && (
                      <button
                        onClick={() => setCommentToDelete(comment.id)}
                        className="text-(--text-primary)/20 hover:text-red-400 transition-colors shrink-0"
                      >
                        <XMarkIcon className="w-4 h-4 mr-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {currentUserId && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder={tr.writeComment}
                  className="flex-1 bg-(--bg-primary) border border-(--border) focus:border-(--text-primary)/20 rounded-xl px-3 py-2 text-xs text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors"
                />
                <button
                  onClick={handleComment}
                  disabled={loadingComment || !commentText.trim()}
                  className="px-3 py-2 rounded-xl bg-(--bg-card) hover:opacity-80 text-xs text-(--text-primary) disabled:opacity-30 transition-colors"
                >
                  {tr.send}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {commentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-(--text-primary)">
              {tr.deleteComment}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {tr.deleteCommentDesc}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setCommentToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:text-(--text-primary) hover:bg-(--bg-card) transition-colors"
              >
                {tr.cancel}
              </button>
              <button
                onClick={confirmDeleteComment}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors"
              >
                {tr.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
