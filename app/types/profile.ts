export type UserPost = {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  _count: { likes: number; comments: number };
};

export type UserReel = {
  id: string;
  url1080p: string;
  thumbnail: string | null;
  views: number;
  createdAt: string;
  _count: { likes: number };
};
