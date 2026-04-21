"use client";
import { useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import type { Post as PostType } from "@/app/types/feed";

interface CreatePostProps {
  onPostCreated?: (post: PostType) => void;
}

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !image) return;
    setLoading(true);

    try {
      let imageUrl = null;

      if (image) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, image);
        if (uploadError) {
          alert(`Не удалось загрузить фото: ${uploadError.message}`);
          setLoading(false);
          return;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("posts").getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: newPost, error } = await supabase
        .from("posts")
        .insert({ content, image_url: imageUrl, user_id: user?.id })
        .select(`*, profiles (username, avatar_url), likes (user_id)`)
        .single();

      if (error) throw error;
      onPostCreated?.(newPost);
      setContent("");
      removeImage();
    } catch (err) {
      console.error("Ошибка публикации:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-(--bg-secondary) p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={3}
        className="w-full bg-(--bg-primary) border border-(--border) focus:border-(--text-primary)/20 rounded-xl p-3 resize-none focus:outline-none text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 transition-colors"
      />

      {preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Превью"
            className="w-full rounded-xl object-cover max-h-64"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="cursor-pointer flex items-center gap-1.5 text-sm text-(--text-primary)/30 hover:text-(--text-primary)/60 transition-colors duration-200">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </label>

        <button
          type="submit"
          disabled={loading || (!content.trim() && !image)}
          className="px-5 py-1.5 rounded-xl text-sm font-semibold text-(--text-primary) bg-(--bg-card) hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Posting...
            </span>
          ) : (
            "Post"
          )}
        </button>
      </div>
    </form>
  );
};

export default CreatePost;
