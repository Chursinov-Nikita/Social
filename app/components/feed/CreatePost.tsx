"use client";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { Post } from "@/app/types/feed";
import { ImagePlus, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const MAX_RAW_SIZE_MB = 20;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const QUALITY = 0.8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const compressImage = (file: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas error"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Load error"));
    };
    img.src = url;
  });

const CreatePost = ({
  onPostCreated,
}: {
  onPostCreated?: (post: Post) => void;
}) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];

  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError(tr.imageTypeError);
      return;
    }
    if (file.size > MAX_RAW_SIZE_MB * 1024 * 1024) {
      setImageError(tr.imageSizeError(MAX_RAW_SIZE_MB));
      return;
    }

    try {
      setCompressing(true);
      const compressed = await compressImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setImage(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setImageError(tr.imageProcessingError);
    } finally {
      setCompressing(false);
    }
  };

  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
    setImageError(null);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !image) return;
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      let imageUrl: string | null = null;

      if (image) {
        const formData = new FormData();
        formData.append("file", image);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        imageUrl = data.url;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, imageUrl }),
      });

      const newPost = await res.json();
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
    <div className="rounded-xl bg-(--bg-secondary) p-4 space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!loading && !compressing && (content.trim() || image))
              handleSubmit();
          }
        }}
        placeholder={tr.whatsOnYourMind}
        rows={3}
        className="w-full bg-(--bg-primary) border border-(--border) focus:border-(--text-primary)/20 rounded-xl p-3 resize-none focus:outline-none text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 transition-colors"
      />

      {imageError && <p className="text-xs text-red-400">{imageError}</p>}
      {compressing && (
        <p className="text-xs text-(--text-primary)/40">
          {tr.imageCompressing}
        </p>
      )}

      {preview && !compressing && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
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
        <label
          className={`cursor-pointer flex items-center gap-1.5 text-sm transition-colors duration-200 ${compressing ? "text-(--text-primary)/20 pointer-events-none" : "text-(--text-primary)/30 hover:text-(--text-primary)/60"}`}
        >
          <ImagePlus className="w-5 h-5" strokeWidth={1} />
          {tr.photo}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageChange}
            disabled={compressing}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || compressing || (!content.trim() && !image)}
          className="px-5 py-1.5 rounded-xl text-sm font-semibold text-(--text-primary) bg-(--bg-card) hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
              {tr.posting}
            </span>
          ) : (
            tr.post
          )}
        </button>
      </div>
    </div>
  );
};

export default CreatePost;
