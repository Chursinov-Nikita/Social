"use client";
import { useState, useRef } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/context/auth";
import type { Video } from "@/app/types/reels";

interface CreateReelProps {
  onReelCreated: (video: Video) => void;
}

const CreateReel = ({ onReelCreated }: CreateReelProps) => {
  const { user } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Only video files are allowed.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File size must be under 50MB.");
      return;
    }

    setError(null);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!videoFile || !user) return;
    setUploading(true);
    setError(null);

    try {
      // 1. загрузить видео в storage
      const fileName = `${user.id}/${crypto.randomUUID()}.mp4`;
      const { error: storageError } = await supabase.storage
        .from("videos")
        .upload(fileName, videoFile, { contentType: videoFile.type });

      if (storageError) throw storageError;

      // 2. получить публичный URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("videos").getPublicUrl(fileName);

      // 3. сохранить в БД
      const { data: savedVideo, error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title: title.trim() || null,
          description: description.trim() || null,
          video_url: publicUrl,
        })
        .select(
          "id, user_id, title, description, video_url, thumbnail_url, views_count, created_at",
        )
        .single();

      if (dbError) throw dbError;

      // 4. получить профиль отдельно
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      const videoWithProfile: Video = {
        ...savedVideo,
        profiles: profile ?? {
          username: user.email?.split("@")[0] ?? "Аноним",
          avatar_url: null,
        },
        video_likes: [],
      };

      onReelCreated(videoWithProfile);
      setTitle("");
      setDescription("");
      setVideoFile(null);
      setVideoPreview(null);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setIsOpen(false);
    setTitle("");
    setDescription("");
    setVideoFile(null);
    setVideoPreview(null);
    setError(null);
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-white/90 transition-colors"
      >
        <svg
          className="w-6 h-6 text-black"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2c2c2e] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">New reel</p>
              <button
                onClick={handleClose}
                disabled={uploading}
                className="text-white/40 hover:text-white transition-colors disabled:opacity-30"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* превью видео */}
            {videoPreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                <video
                  src={videoPreview}
                  className="w-full h-full object-cover"
                  controls
                  muted
                />
                <button
                  onClick={() => {
                    setVideoFile(null);
                    setVideoPreview(null);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-xl border border-dashed border-white/10 bg-[#1c1c1e] flex flex-col items-center justify-center gap-2 hover:border-white/20 transition-colors"
              >
                <svg
                  className="w-8 h-8 text-white/20"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  />
                </svg>
                <span className="text-xs text-white/30">
                  Click to select video
                </span>
                <span className="text-[10px] text-white/20">
                  MP4, MOV up to 50MB
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Title (optional)"
              className="w-full rounded-xl border border-white/5 focus:border-white/20 bg-[#1c1c1e] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none transition-colors"
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-xl border border-white/5 focus:border-white/20 bg-[#1c1c1e] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none resize-none transition-colors"
            />

            {error && <p className="text-xs text-red-300">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={!videoFile || uploading}
              className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Uploading..." : "Post reel"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateReel;
