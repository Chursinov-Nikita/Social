export type ReelAuthor = {
  id: string;
  name: string | null;
  image: string | null;
};

export type Reel = {
  id: string;
  url1080p: string;
  thumbnail: string | null;
  views: number;
  authorId: string;
  author: ReelAuthor;
  likes: { userId: string }[];
  _count: { comments: number };
  createdAt: string;
};
