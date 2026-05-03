"use client";

import type { Reel } from "@/app/types/reels";
import type { Comment } from "@/app/types/feed";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

type Props = {
  reel: Reel;
  currentUserId: string | null;
};

const PostReels = ({ reel, currentUserId }: Props) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likes.length);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(reel._count.comments);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref, inView } = useInView({ threshold: 0.7 });

  useEffect(() => {
    setLiked(reel.likes.some((l) => l.userId === currentUserId));
  }, [currentUserId, reel.likes]);

  useEffect(() => {
    if (inView && !paused) videoRef.current?.play();
    else videoRef.current?.pause();
  }, [inView, paused]);

  const handleVideoClick = () => {
    if (paused) {
      setPaused(false);
      videoRef.current?.play();
    } else {
      setPaused(true);
      videoRef.current?.pause();
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || isLiking) return;
    setIsLiking(true);
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? prevCount - 1 : prevCount + 1);
    try {
      const res = await fetch(`/api/reels/${reel.id}/like`, { method: "POST" });
      const data = await res.json();
      if (data.liked !== !prevLiked) {
        setLiked(data.liked);
        setLikesCount(data.liked ? prevCount + 1 : prevCount - 1);
      }
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  const openComments = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
    setLoadingComments(true);
    const res = await fetch(`/api/reels/${reel.id}/comments`);
    const data: Comment[] = await res.json();
    setComments(data);
    setCommentsCount(data.length);
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    setSendingComment(true);
    const optimistic: Comment = {
      id: crypto.randomUUID(),
      content: commentText.trim(),
      postId: "",
      authorId: currentUserId,
      author: { id: currentUserId, name: "Вы", image: null },
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setCommentsCount((c) => c + 1);
    setCommentText("");

    try {
      const res = await fetch(`/api/reels/${reel.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: optimistic.content }),
      });
      const saved: Comment = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? saved : c)),
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setCommentsCount((c) => c - 1);
      setCommentText(optimistic.content);
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div
      ref={ref}
      className="relative h-dvh w-full bg-(--bg-primary) flex items-center justify-center pb-16"
    >
      <div className="relative bg-black overflow-hidden rounded-xl h-[calc(100dvh-80px)] aspect-9/16">
        {/* Видео */}
        <video
          ref={videoRef}
          src={reel.url1080p}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          loop
          muted={muted}
          playsInline
          onClick={handleVideoClick}
        />

        {/* Пауза */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
              <svg
                className="w-6 h-6 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Mute */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMuted((p) => !p);
          }}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm text-base"
        >
          {muted ? "🔇" : "🔊"}
        </button>

        {/* Info */}
        <div className="absolute bottom-6 left-4 right-14 z-10">
          <div className="flex items-center gap-2">
            {reel.author.image ? (
              <Image
                src={reel.author.image}
                width={28}
                height={28}
                className="rounded-full object-cover shrink-0"
                alt={reel.author.name ?? ""}
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(reel.author.name ?? "?")[0].toUpperCase()}
              </div>
            )}
            <p className="text-white font-semibold text-sm truncate">
              {reel.author.name}
            </p>
          </div>
        </div>

        {/* Кнопки справа */}
        <div className="absolute bottom-6 right-4 z-10 flex flex-col items-center gap-4">
          {/* Лайк */}
          <button
            onClick={handleLike}
            disabled={!currentUserId}
            className="flex flex-col items-center gap-1 disabled:opacity-50"
          >
            <svg
              className={`w-7 h-7 transition-colors ${liked ? "fill-red-500 text-red-500" : "fill-none text-white"}`}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span className="text-white text-xs">{likesCount}</span>
          </button>

          {/* Комментарии */}
          <button
            onClick={openComments}
            className="flex flex-col items-center gap-1"
          >
            <svg
              className="w-7 h-7 text-white fill-none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-white text-xs">{commentsCount}</span>
          </button>
        </div>
      </div>

      {/* Шторка комментариев */}
      {showComments && (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center"
          onClick={() => setShowComments(false)}
        >
          <div
            className="bg-(--bg-secondary) rounded-t-2xl p-4 space-y-3 max-h-[60dvh] flex flex-col w-[calc((100dvh-80px)*9/16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-(--text-primary)">
                Комментарии
              </p>
              <button
                onClick={() => setShowComments(false)}
                className="text-(--text-primary)/40 hover:text-(--text-primary)"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 [scrollbar-width:none]">
              {loadingComments ? (
                <p className="text-xs text-(--text-primary)/30 text-center py-4">
                  Загрузка...
                </p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-(--text-primary)/30 text-center py-4">
                  Нет комментариев
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    {c.author.image ? (
                      <Image
                        src={c.author.image}
                        width={28}
                        height={28}
                        className="rounded-full object-cover shrink-0"
                        alt={c.author.name ?? ""}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-(--bg-card) flex items-center justify-center text-xs font-bold text-(--text-primary) shrink-0">
                        {c.author.name?.[0].toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-(--text-primary)/70">
                        {c.author.name}
                      </p>
                      <p className="text-xs text-(--text-primary)/50">
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {currentUserId && (
              <div className="flex gap-2 pt-2 border-t border-(--border)">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder="Написать комментарий..."
                  className="flex-1 bg-(--bg-primary) border border-(--border) rounded-xl px-3 py-2 text-xs text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none"
                />
                <button
                  onClick={sendComment}
                  disabled={sendingComment || !commentText.trim()}
                  className="px-3 py-2 rounded-xl bg-(--bg-card) text-xs text-(--text-primary) disabled:opacity-30"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostReels;
