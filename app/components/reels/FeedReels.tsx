"use client";

import { useSession } from "next-auth/react";
import type { Reel } from "@/app/types/reels";
import { useEffect, useState } from "react";
import PostReels from "./PostReels";
import CreateReel from "./CreateReel";

const FeedReels = () => {
  const { data: session } = useSession();
  const [reels, setReels] = useState<Reel[]>([]);
  const currentUserId = session?.user?.id ?? null;

  useEffect(() => {
    fetch("/api/reels")
      .then((r) => r.json())
      .then(setReels);
  }, []);

  return (
    <div className="relative">
      <div className="h-dvh overflow-y-scroll snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {reels.map((reel) => (
          <div key={reel.id} className="snap-start snap-always h-dvh">
            <PostReels reel={reel} currentUserId={currentUserId} />
          </div>
        ))}
      </div>
      <CreateReel />
    </div>
  );
};

export default FeedReels;
