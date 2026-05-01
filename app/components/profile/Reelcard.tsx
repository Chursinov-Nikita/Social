import { UserReels } from "@/app/types/profile";
import { Eye, Heart } from "lucide-react";

export function ReelCard({ reel }: { reel: UserReels }) {
  return (
    <article className="group relative aspect-9/16 overflow-hidden rounded-xl border border-(--border) bg-(--bg-card)">
      <video
        src={reel.video_url ?? undefined}
        preload="metadata"
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play()}
        onMouseLeave={(e) => {
          const v = e.currentTarget as HTMLVideoElement;
          v.pause();
          v.currentTime = 0;
        }}
      />

      {/* Gradient */}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Play icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40 transition-opacity group-hover:opacity-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <svg
            className="h-3 w-3 translate-x-px text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Stats (visible on hover) */}
      <div className="absolute bottom-0 left-0 right-0 translate-y-1 p-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        {reel.title && (
          <p className="mb-1 line-clamp-1 text-[9px] font-medium text-white/80">
            {reel.title}
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-[9px] text-white/70">
            <Heart size={8} strokeWidth={2} />
            {reel.video_likes[0]?.count ?? 0}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[9px] text-white/70">
            <Eye size={8} strokeWidth={2} />
            {reel.views_count ?? 0}
          </span>
          <span className="ml-auto text-[8px] tabular-nums text-white/40">
            {new Date(reel.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </article>
  );
}
