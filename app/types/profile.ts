export type UserPost = {
  id: string;
  content: string | null;
  image_url: string | null;
  likes_count: number | null;
  comments: [{ count: number }] | [];
  created_at: string;
};
