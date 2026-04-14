import { createClient } from "./lib/supabase/server";
import Feed from "./components/feed/page";
import type { Post as PostType } from "@/app/types/feed";

export default async function Home() {
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select(`*, profiles (username, avatar_url), likes (user_id)`) // JOIN с таблицей профилей
    .order("created_at", { ascending: false })
    .range(0, 9)
    .returns<PostType[]>();

  if (error) {
    console.error("Ошибка", JSON.stringify(error));
    return <div>Не удалось загрузить ленту.</div>;
  }

  return (
    <main>
      <Feed initialPosts={posts} />;
    </main>
  );
}
