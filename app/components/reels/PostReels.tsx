import { createClient } from "@/app/lib/supabase/client";
import { PostReelsProps } from "@/app/types/reels";
import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

const PostReels = ({ video, currentUserId, initialLiked }: PostReelsProps) => {
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(video.video_likes?.length ?? 0);
  const [muted, setMuted] = useState(true);
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref, inView } = useInView({ threshold: 0.7 });

  const handleLike = async () => {
    const prevLiked = liked;
    const prevCount = likesCount;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(newLiked ? prevCount + 1 : prevCount - 1);
    if (newLiked) {
      const { error } = await supabase
        .from("video_likes")
        .insert({ video_id: video.id, user_id: currentUserId });
      if (error) {
        setLiked(prevLiked);
        setLikesCount(prevCount);
      }
    } else {
      const { error } = await supabase
        .from("video_likes")
        .delete()
        .eq("video_id", video.id)
        .eq("user_id", currentUserId);
      if (error) {
        setLiked(prevLiked);
        setLikesCount(prevCount);
      }
    }
  };

  useEffect(() => {
    if (inView) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
  }, [inView]);

  return (
    <div ref={ref} className="relative h-dvh w-full bg-black overflow-hidden">
      <video
        src={video.video_url}
        ref={videoRef}
        className="w-96 h-96 object-cover"
        loop
        muted={muted}
        playsInline
      />

      <button
        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white"
        onClick={() => setMuted((prev) => !prev)}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <div className="absolute bottom-20 left-4 right-4 z-10 flex items-end justify-between">
        <div>
          <p className="text-white font-semibold text-sm">
            @{video.profiles?.username}
          </p>
          <p className="text-white/60 text-xs mt-1">{video.title}</p>
        </div>

        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-2xl">{liked ? "❤️" : "🤍"}</span>
          <span className="text-white text-xs">{likesCount}</span>
        </button>
      </div>
    </div>
  );
};

export default PostReels;
