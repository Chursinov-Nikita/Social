export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  views_count: number;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
  video_likes: { user_id: string }[];
}

export interface PostReelsProps {
  video: Video;
  currentUserId: string | null;
  initialLiked: boolean;
}
