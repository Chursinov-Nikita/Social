import { UserReel } from "@/app/types/profile";
import { Eye, Heart, Play } from "lucide-react";

const ReelCard = ({ reel }: { reel: UserReel }) => (
  <article className="group relative aspect-9/16 overflow-hidden rounded-xl border border-(--border) bg-(--bg-card)">
    <video
      src={reel.url1080p}
      preload="metadata"
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      onMouseEnter={(e) => void e.currentTarget.play()}
      onMouseLeave={(e) => {
        e.currentTarget.pause();
        e.currentTarget.currentTime = 0;
      }}
    />
    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    <div className="absolute inset-0 flex items-center justify-center opacity-40 transition-opacity group-hover:opacity-0">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
        <Play className=" translate-x-px text-white" fill="currentColor" />
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 translate-y-1 p-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-0.5 text-[9px] text-white/70">
          <Heart size={8} strokeWidth={2} /> {reel._count.likes}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[9px] text-white/70">
          <Eye size={8} strokeWidth={2} /> {reel.views}
        </span>
        <span className="ml-auto text-[8px] tabular-nums text-white/40">
          {new Date(reel.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  </article>
);

export default ReelCard;
