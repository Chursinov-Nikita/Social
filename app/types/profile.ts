export type UserPost = {
  id: string;
  content: string | null;
  image_url: string | null;
  likes_count: number | null;
  comments: [{ count: number }] | [];
  created_at: string;
};

export type UserReels = {
  id: string;
  title: string;
  video_url: string;
  likes_count: number | null;
  views_count: number;
  created_at: string;
  video_likes: { count: number }[];
};
