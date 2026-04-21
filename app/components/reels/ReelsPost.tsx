"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { createClient } from "@/app/lib/supabase/client";
import type { Video } from "@/app/types/reels";

interface ReelsPostProps {
  video: Video;
  currentUserId: string | null;
  initialLiked: boolean;
}

const ReelsPost = ({ video, currentUserId, initialLiked }: ReelsPostProps) => {
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(video.video_likes?.length ?? 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [muted, setMuted] = useState(true);

  const { ref, inView } = useInView({ threshold: 0.7 });

  useEffect(() => {
    if (!videoRef.current) return;
    if (inView) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    const timer = setTimeout(async () => {
      await supabase.rpc("increment_views", { video_id: video.id });
    }, 3000);
    return () => clearTimeout(timer);
  }, [inView, video.id, supabase]);

  const handleLike = async () => {
    if (!currentUserId || isLiking) return;
    setIsLiking(true);

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
          .from("video_likes")
          .upsert(
            { video_id: video.id, user_id: currentUserId },
            { onConflict: "video_id,user_id", ignoreDuplicates: true },
          );
        if (error) {
          setLiked(previousLiked);
          setLikesCount(previousCount);
        }
      } else {
        const { error } = await supabase
          .from("video_likes")
          .delete()
          .eq("video_id", video.id)
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

  const username = video.profiles?.username ?? "Аноним";

  return (
    <div
      ref={ref}
      className="relative h-dvh w-full bg-[#1c1c1e] overflow-hidden flex items-center justify-center"
    >
      {/* Размытый фон */}
      <div className="absolute inset-0 bg-[#1c1c1e]" />

      {/* Основное видео по центру */}
      <video
        ref={videoRef}
        src={video.video_url}
        preload="auto"
        className="relative z-10 h-full max-w-90 py-7 mb-13 object-contain"
        loop
        muted={muted}
        playsInline
        onClick={() => setMuted((prev) => !prev)}
      />

      {/* Затемнение снизу */}
      <div className="absolute inset-0 z-20 bg-linear-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* Кнопка mute */}
      <button
        onClick={() => setMuted((prev) => !prev)}
        className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
      >
        {muted ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0017.73 19L19 20.27 20.27 19 5.27 4 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      {/* Нижняя панель */}
      <div className="absolute bottom-0 z-30 pb-20 px-7 flex items-end gap-4 w-[calc(100vh*9/16)] max-w-full left-1/2 -translate-x-1/2">
        {/* Инфо о видео */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">@{username}</p>
          {video.title && (
            <p className="text-white/80 text-sm mt-1">{video.title}</p>
          )}
          {video.description && (
            <div>
              <p
                className={`text-white/60 text-xs mt-1 leading-relaxed ${
                  showDescription ? "" : "line-clamp-2"
                }`}
              >
                {video.description}
              </p>
              {video.description.length > 80 && (
                <button
                  onClick={() => setShowDescription((prev) => !prev)}
                  className="text-white/40 text-xs mt-0.5"
                >
                  {showDescription ? "collapse" : "more"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-col items-center gap-5 shrink-0">
          {/* Аватар */}
          <div className="w-10 h-10 rounded-full bg-[#3a3a3c] border-2 border-white flex items-center justify-center text-sm font-bold text-white shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>

          {/* Лайк */}
          <button
            onClick={handleLike}
            disabled={!currentUserId}
            className="flex flex-col items-center gap-1 disabled:opacity-30"
          >
            {liked ? (
              <HeartSolidIcon className="w-7 h-7 text-red-400" />
            ) : (
              <HeartIcon className="w-7 h-7 text-white" />
            )}
            <span className="text-white text-xs font-medium">{likesCount}</span>
          </button>

          {/* Просмотры */}
          <div className="flex flex-col items-center gap-1">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-white text-xs font-medium">
              {video.views_count}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReelsPost;
