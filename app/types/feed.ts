export type PostAuthor = {
  id: string;
  name: string | null;
  image: string | null;
};

export type Post = {
  id: string;
  content: string;
  imageUrl: string | null;
  authorId: string;
  author: PostAuthor;
  likes: { userId: string }[];
  _count: { comments: number };
  createdAt: string;
};

export type Comment = {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  author: PostAuthor;
  createdAt: string;
};
