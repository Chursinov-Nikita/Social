"use client";

import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { Comment } from "@/app/types/feed";
import type { Reel } from "@/app/types/reels";
import {
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Pause,
  Volume2Icon,
  VolumeOffIcon,
  X,
} from "lucide-react";
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
  const [views, setViews] = useState(reel.views);
  const viewedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref, inView } = useInView({ threshold: 0.7 });
  const { lang } = useLang();
  const tr = t[lang];

  useEffect(() => {
    setLiked(reel.likes.some((l) => l.userId === currentUserId));
  }, [currentUserId, reel.likes]);

  useEffect(() => {
    if (inView && !paused) {
      videoRef.current?.play();
      // Считаем просмотр один раз
      if (!viewedRef.current) {
        viewedRef.current = true;
        fetch(`/api/reels/${reel.id}/view`, { method: "POST" });
        setViews((v) => v + 1);
      }
    } else {
      videoRef.current?.pause();
    }
  }, [inView, paused, reel.id]);

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
              <Pause />
            </div>
          </div>
        )}

        {/* Mute */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMuted((p) => !p);
          }}
          className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm text-base"
        >
          {muted ? (
            // Звук выключен — перечёркнутый
            <VolumeOffIcon className="w-3.5 h-3.5" />
          ) : (
            // Звук включен — с 2 полосками
            <Volume2Icon className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Info */}
        <div className="absolute bottom-6 left-4 right-14 z-10">
          <div className="flex items-center gap-2 mb-1">
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
            <Heart />
            <span className="text-white text-xs">{likesCount}</span>
          </button>

          {/* Комментарии */}
          <button
            onClick={openComments}
            className="flex flex-col items-center gap-1"
          >
            <MessageCircle />
            <span className="text-white text-xs">{commentsCount}</span>
          </button>

          <div className="flex flex-col items-center gap-1">
            <Eye />
            <span className="text-white text-xs">{views}</span>
          </div>
        </div>

        {/* Шторка комментариев */}
        {showComments && (
          <div
            className="absolute inset-0 z-20 flex items-end"
            onClick={() => setShowComments(false)}
          >
            <div
              className="w-full bg-(--bg-secondary) rounded-t-2xl p-4 space-y-3 max-h-[60%] flex flex-col"
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
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 [scrollbar-width:none]">
                {loadingComments ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    {tr.loadingComments}
                  </span>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-(--text-primary)/30 text-center py-4">
                    {tr.noCommentsYet}
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
    </div>
  );
};

export default PostReels;
