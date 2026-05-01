import { useAuth } from "@/app/context/auth";
import { createClient } from "@/app/lib/supabase/client";
import { Video } from "@/app/types/reels";
import { useEffect, useMemo, useState } from "react";
import PostReels from "./PostReels";

const FeedReels = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    const loadReels = async () => {
      const { data } = await supabase
        .from("videos")
        .select(
          "id, user_id, title, description, video_url, thumbnail_url, views_count, created_at, profiles(username, avatar_url), video_likes(user_id)",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setVideos(data);
    };
    void loadReels();
  }, [supabase]);

  return (
    <div>
      <h1>FeedReels</h1>
      <div className="h-dvh overflow-y-scroll snap-y snap-mandatory">
        {videos.map((video) => (
          <div key={video.id} className="snap-start snap-always h-dvh">
            <PostReels
              video={video}
              currentUserId={user?.id ?? null}
              initialLiked={
                video.video_likes?.some(
                  (likes) => likes.user_id === user?.id,
                ) ?? false
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedReels;
