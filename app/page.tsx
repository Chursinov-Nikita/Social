import { createClient } from "./lib/supabase/server";
import Feed from "./components/feed/page";
import type { Post as PostType } from "@/app/types/feed";

const PAGE_SIZE = 10;

export default async function Home() {
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      "id, user_id, content, image_url, likes_count, comments_count, created_at, profiles (username, avatar_url), likes (user_id)",
    )
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1)
    .returns<PostType[]>();

  if (error) {
    console.error("Ошибка", JSON.stringify(error));
    return <div>Не удалось загрузить ленту.</div>;
  }

  return (
    <main>
      <Feed initialPosts={posts ?? []} />
    </main>
  );
}
