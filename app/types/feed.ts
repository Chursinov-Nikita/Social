export interface Profile {
  username: string;
  avatar_url: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: Profile | null;
  likes?: { user_id: string }[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface PostProps {
  post: Post;
  currentUserId: string | null;
  initialLiked: boolean;
}

export interface CreatePostProps {
  onPostCreated?: (post: Post) => void;
}
