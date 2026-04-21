"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/app/lib/supabase/client";
import ReelsPost from "./ReelsPost";
import type { Video } from "@/app/types/reels";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useAuth } from "@/app/context/auth";
import CreateReel from "./CreateReel";

const PAGE_SIZE = 10;

const mergeUniqueVideos = (current: Video[], incoming: Video[]) => {
  const seenIds = new Set(current.map((v) => v.id));
  const uniqueIncoming = incoming.filter((v) => !seenIds.has(v.id));
  return [...current, ...uniqueIncoming];
};

const getInitialReelsState = (initialVideos: Video[]) => {
  const safeVideos = initialVideos ?? [];
  return {
    videos: safeVideos,
    page: 1,
    hasMore: safeVideos.length === PAGE_SIZE,
  };
};

const ReelsFeed = ({ initialVideos }: { initialVideos: Video[] }) => {
  const [initialReelsState] = useState(() =>
    getInitialReelsState(initialVideos),
  );
  const [videos, setVideos] = useState<Video[]>(initialReelsState.videos);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialReelsState.page);
  const [hasMore, setHasMore] = useState(initialReelsState.hasMore);
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setupRealtime = async () => {
      const channel = supabase
        .channel("videos-channel")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "videos" },
          (payload: RealtimePostgresChangesPayload<Video>) => {
            const newVideo = payload.new as Video;
            if (newVideo.user_id !== currentUserId) {
              setVideos((prev) => mergeUniqueVideos([newVideo], prev));
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "videos" },
          (payload: RealtimePostgresChangesPayload<Video>) => {
            const oldVideo = payload.old as Partial<Video>;
            setVideos((prev) => prev.filter((v) => v.id !== oldVideo.id));
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

  async function loadMoreVideos() {
    if (loading || !hasMore) return;

    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: newVideos, error } = (await supabase
      .from("videos")
      .select(
        "id, user_id, title, description, video_url, thumbnail_url, views_count, created_at, profiles (username, avatar_url), video_likes (user_id)",
      )
      .order("created_at", { ascending: false })
      .range(from, to)) as { data: Video[] | null; error: unknown };

    if (!error && newVideos && newVideos.length > 0) {
      setVideos((prev) => mergeUniqueVideos(prev, newVideos));
      setPage((prev) => prev + 1);
      if (newVideos.length < PAGE_SIZE) setHasMore(false);
    } else if (!error) {
      setHasMore(false);
    }

    setLoading(false);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom =
        scrollHeight - scrollTop - clientHeight < clientHeight;
      if (isNearBottom && !loading && hasMore) {
        void loadMoreVideos();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, page]);

  return (
    <div
      ref={containerRef}
      className="h-dvh overflow-y-scroll snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {videos.map((video) => (
        <div key={video.id} className="snap-start snap-always h-dvh">
          <ReelsPost
            video={video}
            currentUserId={currentUserId}
            initialLiked={
              video.video_likes?.some(
                (l: { user_id: string }) => l.user_id === currentUserId,
              ) ?? false
            }
          />
        </div>
      ))}
      {/* индикатор загрузки внизу */}
      {loading && (
        <div className="snap-start snap-always h-dvh flex items-center justify-center bg-[#1c1c1e]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
        </div>
      )}
      {!hasMore && videos.length > 0 && (
        <div className="snap-start snap-always h-dvh flex items-center justify-center bg-[#1c1c1e]">
          <p className="text-white/20 text-sm">No more videos</p>
        </div>
      )}
      <CreateReel
        onReelCreated={(video) =>
          setVideos((prev) => mergeUniqueVideos([video], prev))
        }
      />
    </div>
  );
};

export default ReelsFeed;
