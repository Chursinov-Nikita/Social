"use client";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { Comment, Post } from "@/app/types/feed";
import {
  ChatBubbleLeftIcon,
  EllipsisHorizontalIcon,
  HeartIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// In-memory кэш комментариев
const MAX_CACHE = 50;
const cache = new Map<string, Comment[]>();
const setCache = (id: string, comments: Comment[]) => {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(id, comments);
};

type Props = {
  post: Post;
  currentUserId: string | null;
  onPostDeleted?: (id: string) => void;
  onLikeChange?: (id: string, liked: boolean) => void;
};

const PostCard = ({
  post,
  currentUserId,
  onPostDeleted,
  onLikeChange,
}: Props) => {
  const { lang } = useLang();
  const tr = t[lang];

  const liked = (post.likes ?? []).some((l) => l.userId === currentUserId);
  const likesCount = (post.likes ?? []).length;

  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(cache.get(post.id) ?? []);
  const [commentsCount, setCommentsCount] = useState(post._count.comments);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const loadComments = useCallback(
    async (force = false) => {
      const cached = cache.get(post.id);
      if (cached && !force) {
        setComments(cached);
        return;
      }
      setLoadingComments(true);
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data: Comment[] = await res.json();
      setCache(post.id, data);
      setComments(data);
      setCommentsCount(data.length);
      setLoadingComments(false);
    },
    [post.id],
  );

  useEffect(() => {
    if (showComments) loadComments();
  }, [showComments, loadComments]);

  const handleLike = async () => {
    if (!currentUserId || isLiking) return;
    setIsLiking(true);
    onLikeChange?.(post.id, !liked);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();
      if (data.liked !== !liked) onLikeChange?.(post.id, data.liked);
    } catch {
      onLikeChange?.(post.id, liked);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    setLoadingComment(true);
    const optimistic: Comment = {
      id: crypto.randomUUID(),
      content: commentText.trim(),
      postId: post.id,
      authorId: currentUserId,
      author: { id: currentUserId, name: tr.you ?? "Вы", image: null },
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => {
      const next = [...prev, optimistic];
      setCache(post.id, next);
      return next;
    });
    setCommentsCount((c) => c + 1);
    setCommentText("");

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: optimistic.content }),
      });
      const saved: Comment = await res.json();
      setComments((prev) => {
        const next = prev.map((c) => (c.id === optimistic.id ? saved : c));
        setCache(post.id, next);
        return next;
      });
    } catch {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== optimistic.id);
        setCache(post.id, next);
        return next;
      });
      setCommentsCount((c) => c - 1);
      setCommentText(optimistic.content);
    } finally {
      setLoadingComment(false);
    }
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    const prev = comments;
    setComments((c) => {
      const next = c.filter((x) => x.id !== commentToDelete);
      setCache(post.id, next);
      setCommentsCount(next.length);
      return next;
    });
    setCommentToDelete(null);
    try {
      await fetch(`/api/posts/${post.id}/comments/${commentToDelete}`, {
        method: "DELETE",
      });
    } catch {
      setComments(prev);
      setCommentsCount(prev.length);
    }
  };

  const handleDeletePost = async () => {
    if (deletingPost) return;
    setDeletingPost(true);
    try {
      await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      cache.delete(post.id);
      onPostDeleted?.(post.id);
    } catch {
      setDeletingPost(false);
    }
  };

  const isOwn = currentUserId === post.authorId;
  const username = post.author.name ?? "Аноним";

  return (
    <div className="rounded-xl bg-(--bg-secondary) overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {post.author.image ? (
            <Image
              src={post.author.image}
              width={40}
              height={40}
              className="rounded-full object-cover w-10 h-10"
              alt={username}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold text-(--text-primary) shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-sm text-(--text-primary)">
            {username}
          </span>
        </div>

        {isOwn && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((p) => !p)}
              className="p-1.5 rounded-lg text-(--text-primary)/30 hover:text-(--text-primary)/70 hover:bg-(--bg-card) transition-colors"
            >
              <EllipsisHorizontalIcon className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-20 min-w-37.5 rounded-xl border border-(--border) bg-(--bg-secondary) shadow-lg overflow-hidden">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-(--bg-card) transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  {tr.deletePost ?? "Удалить пост"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.imageUrl && (
        <div className="relative w-full aspect-video">
          <Image
            src={post.imageUrl}
            fill
            sizes="100vw"
            className="object-cover px-4"
            alt="Изображение поста"
          />
        </div>
      )}

      <div className="px-4 pb-4 pt-2 space-y-3">
        {post.content && (
          <p className="text-sm text-(--text-primary)/80 leading-relaxed">
            {post.content}
          </p>
        )}
        <div className="h-px bg-(--border)" />

        <div className="flex space-x-4">
          <button
            onClick={handleLike}
            disabled={!currentUserId || isLiking}
            className={`flex items-center space-x-1.5 text-sm transition-all duration-200 disabled:opacity-30 ${liked ? "text-red-400" : "text-(--text-primary)/30 hover:text-red-400"}`}
          >
            {liked ? (
              <HeartSolidIcon className="w-5 h-5" />
            ) : (
              <HeartIcon className="w-5 h-5" />
            )}
            <span>{likesCount}</span>
          </button>

          <button
            onClick={() => setShowComments((p) => !p)}
            className={`flex items-center space-x-1.5 text-sm transition-colors duration-200 ${showComments ? "text-(--text-primary)/60" : "text-(--text-primary)/30 hover:text-(--text-primary)/60"}`}
          >
            <ChatBubbleLeftIcon className="w-5 h-5" />
            <span>{commentsCount}</span>
          </button>
        </div>

        {showComments && (
          <div className="space-y-3 pt-1">
            <div className="h-px bg-(--border)" />
            <div className="space-y-3 max-h-48 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {loadingComments ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  {tr.loadingComments}
                </span>
              ) : comments.length === 0 ? (
                <p className="text-xs text-(--text-primary)/20 text-center py-2">
                  {tr.noCommentsYet}
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-(--bg-card) flex items-center justify-center text-xs font-bold text-(--text-primary) shrink-0">
                      {comment.author.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-(--text-primary)/70 mr-1">
                        {comment.author.name}
                      </span>
                      <p className="text-xs text-(--text-primary)/50 leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                    {comment.authorId === currentUserId && (
                      <button
                        onClick={() => setCommentToDelete(comment.id)}
                        className="text-(--text-primary)/20 hover:text-red-400 transition-colors shrink-0"
                      >
                        <XMarkIcon className="w-4 h-4 mr-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {currentUserId && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder={tr.writeComment}
                  className="flex-1 bg-(--bg-primary) border border-(--border) focus:border-(--text-primary)/20 rounded-xl px-3 py-2 text-xs text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors"
                />
                <button
                  onClick={handleComment}
                  disabled={loadingComment || !commentText.trim()}
                  className="px-3 py-2 rounded-xl bg-(--bg-card) hover:opacity-80 text-xs text-(--text-primary) disabled:opacity-30 transition-colors"
                >
                  {tr.send}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалка удаления комментария */}
      {commentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-(--text-primary)">
              {tr.deleteComment}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {tr.deleteCommentDesc}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setCommentToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors"
              >
                {tr.cancel}
              </button>
              <button
                onClick={confirmDeleteComment}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors"
              >
                {tr.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка удаления поста */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-(--text-primary)">
              {tr.deletePost ?? "Удалить пост"}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {tr.deletePostDesc ?? "Это действие нельзя отменить."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingPost}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors disabled:opacity-30"
              >
                {tr.cancel}
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deletingPost}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingPost ? (
                  <>
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      {tr.deleting}
                    </span>
                  </>
                ) : (
                  tr.delete
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
