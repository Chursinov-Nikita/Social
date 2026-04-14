"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  HeartIcon,
  ChatBubbleLeftIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { createClient } from "@/app/lib/supabase/client";
import type { Comment, PostProps, Post } from "@/app/types/feed";

const Post = ({ post, currentUserId, initialLiked }: PostProps) => {
  const supabase = createClient();
  const [liked, setLiked] = useState<boolean>(initialLiked);
  const [likesCount, setLikesCount] = useState<number>(post.likes_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsCount, setCommentsCount] = useState(post.comments_count ?? 0);
  const [loadingComment, setLoadingComment] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    const loadComments = async () => {
      const { data } = (await supabase
        .from("comments")
        .select("*, profiles:user_id (username, avatar_url)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })) as {
        data: Comment[] | null;
      };
      if (data) {
        setComments(data);
        setCommentsCount(data.length);
      }
    };

    if (showComments) {
      loadComments();
    }

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
        async () => {
          await loadComments();
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
        async () => {
          await loadComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, supabase, showComments]);

  const handleLike = async () => {
    if (!currentUserId) return;
    const newLiked = !liked;
    const newCount = newLiked ? likesCount + 1 : likesCount - 1;
    setLiked(newLiked);
    setLikesCount(newCount);

    if (newLiked) {
      const { error } = await supabase
        .from("likes")
        .insert({ post_id: post.id, user_id: currentUserId });
      if (error) {
        setLiked(false);
        setLikesCount(likesCount);
      }
    } else {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
      if (error) {
        setLiked(true);
        setLikesCount(likesCount);
      }
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

    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: currentUserId,
      content: optimisticComment.content,
    });

    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setCommentsCount((prev) => Math.max(prev - 1, 0));
      setCommentText(optimisticComment.content);
    }

    setLoadingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentsCount((prev) => Math.max(prev - 1, 0));
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
            onClick={() => {
              setShowComments((prev) => {
                if (prev) setComments([]);
                return !prev;
              });
            }}
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
              {comments.length === 0 ? (
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
