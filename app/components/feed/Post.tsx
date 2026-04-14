"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import {
  HeartIcon,
  ChatBubbleLeftIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import type { Comment, PostProps } from "@/app/types/feed";

const commentsCache = new Map<string, Comment[]>();

const Post = ({ post, currentUserId, initialLiked }: PostProps) => {
  const supabase = useMemo(() => createClient(), []);
  const [liked, setLiked] = useState<boolean>(initialLiked);
  const [likesCount, setLikesCount] = useState<number>(post.likes_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsCount, setCommentsCount] = useState(post.comments_count ?? 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);
  const lastPostIdRef = useRef(post.id);

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
    setHasLoadedComments(false);
    setShowComments(false);
  }, [post.id, post.likes_count, post.comments_count, initialLiked]);

  useEffect(() => {
    let isCancelled = false;

    const syncCommentsCount = async () => {
      const { count, error } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id);

      if (!error && typeof count === "number" && !isCancelled) {
        setCommentsCount(count);
      }
    };

    void syncCommentsCount();

    return () => {
      isCancelled = true;
    };
  }, [post.id, supabase]);

  const loadComments = useCallback(async (forceRefresh = false) => {
    const cachedComments = commentsCache.get(post.id);
    if (cachedComments && !forceRefresh) {
      setComments(cachedComments);
      setCommentsCount(cachedComments.length);
      setHasLoadedComments(true);
      return;
    }

    if (!cachedComments) {
      setLoadingComments(true);
    }

    const { data } = (await supabase
      .from("comments")
      .select("id, post_id, user_id, content, created_at, profiles:user_id (username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })) as {
      data: Comment[] | null;
    };

    if (data) {
      commentsCache.set(post.id, data);
      setComments(data);
      setCommentsCount(data.length);
      setHasLoadedComments(true);
    }
    setLoadingComments(false);
  }, [post.id, supabase]);

  useEffect(() => {
    if (showComments && !hasLoadedComments) {
      loadComments();
    }
  }, [showComments, hasLoadedComments, loadComments]);

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
          const insertedCommentId = (payload.new as Partial<Comment>).id;
          if (!insertedCommentId) return;

          const { data: insertedComment } = (await supabase
            .from("comments")
            .select(
              "id, post_id, user_id, content, created_at, profiles:user_id (username, avatar_url)",
            )
            .eq("id", insertedCommentId)
            .single()) as { data: Comment | null };

          if (!insertedComment) return;

          setComments((prev) => {
            if (prev.some((c) => c.id === insertedComment.id)) return prev;
            const next = [...prev, insertedComment];
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
          const deletedCommentId = (payload.old as Partial<Comment>).id;
          if (!deletedCommentId) return;
          setComments((prev) => {
            const next = prev.filter((comment) => comment.id !== deletedCommentId);
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

  const handleLike = async () => {
    if (!currentUserId || isLiking) return;
    setIsLiking(true);

    const previousLiked = liked;
    const previousCount = likesCount;
    const newLiked = !liked;
    const newCount = newLiked
      ? previousCount + 1
      : Math.max(previousCount - 1, 0);

    setLiked(newLiked);
    setLikesCount(newCount);

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
        }
      }
    } finally {
      setIsLiking(false);
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

    setComments((prev) => [...prev, optimisticComment]);
    setCommentsCount((prev) => prev + 1);
    setCommentText("");
    commentsCache.set(post.id, [...comments, optimisticComment]);

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
        const next = prev.map((comment) =>
          comment.id === optimisticComment.id ? savedComment : comment,
        );
        commentsCache.set(post.id, next);
        return next;
      });
    }

    setLoadingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== commentId);
      commentsCache.set(post.id, next);
      setCommentsCount(next.length);
      return next;
    });
    await supabase.from("comments").delete().eq("id", commentId);
  };

  const username = post.profiles?.username ?? "Аноним";
  const avatarUrl = post.profiles?.avatar_url ?? null;

  return (
    <div className="rounded-xl bg-[#2c2c2e] overflow-hidden">
      {/* Header */}
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
          <div className="w-10 h-10 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold text-white shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-sm text-white">{username}</span>
      </div>

      {/* Image */}
      {post.image_url ? (
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
      ) : null}

      {/* Content */}
      <div className="px-4 pb-4 pt-2 space-y-3">
        {post.content && (
          <p className="text-sm text-white/80 leading-relaxed">
            {post.content}
          </p>
        )}

        <div className="h-px bg-white/5" />

        <div className="flex space-x-4">
          <button
            onClick={handleLike}
            disabled={!currentUserId}
            className={`flex items-center space-x-1.5 text-sm transition-all duration-200 disabled:opacity-30
              ${liked ? "text-red-400" : "text-white/30 hover:text-red-400"}`}
          >
            {liked ? (
              <HeartSolidIcon className="w-5 h-5" />
            ) : (
              <HeartIcon className="w-5 h-5" />
            )}
            <span>{likesCount}</span>
          </button>

          <button
            onClick={() => setShowComments((prev) => !prev)}
            className={`flex items-center space-x-1.5 text-sm transition-colors duration-200
              ${showComments ? "text-white/60" : "text-white/30 hover:text-white/60"}`}
          >
            <ChatBubbleLeftIcon className="w-5 h-5" />
            <span>{commentsCount}</span>
          </button>
        </div>

        {showComments && (
          <div className="space-y-3 pt-1">
            <div className="h-px bg-white/5" />

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {loadingComments ? (
                <p className="text-xs text-white/20 text-center py-2">
                  Loading comments...
                </p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-2">
                  No comments yet
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#3a3a3c] flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {comment.profiles?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-white/70 mr-1">
                        {comment.profiles?.username}
                      </span>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                    {comment.user_id === currentUserId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                      >
                        <XMarkIcon className="w-4 h-4" />
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
                  placeholder="Write a comment..."
                  className="flex-1 bg-[#1c1c1e] border border-white/5 focus:border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-colors"
                />
                <button
                  onClick={handleComment}
                  disabled={loadingComment || !commentText.trim()}
                  className="px-3 py-2 rounded-xl bg-[#3a3a3c] hover:bg-[#48484a] text-xs text-white disabled:opacity-30 transition-colors"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Post;
