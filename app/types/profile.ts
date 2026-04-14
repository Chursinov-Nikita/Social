export type UserPost = {
  id: string;
  content: string | null;
  image_url: string | null;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string;
};
