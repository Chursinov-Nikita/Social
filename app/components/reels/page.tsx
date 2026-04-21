import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import ReelsFeed from "@/app/components/reels/ReelsFeed";
import type { Video } from "@/app/types/reels";

export default async function ReelsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );

  const { data: videos, error } = await supabase
    .from("videos")
    .select(
      "id, user_id, title, description, video_url, thumbnail_url, profiles (username, avatar_url), views_count, created_at, video_likes (user_id)",
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error("Error");

  return <ReelsFeed initialVideos={(videos ?? []) as unknown as Video[]} />;
}
