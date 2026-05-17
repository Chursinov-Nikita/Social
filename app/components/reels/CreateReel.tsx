"use client";

import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import { Loader2, PlusCircleIcon, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";

const CreateReel = () => {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();
  const tr = t[lang];

  const handleUpload = async () => {
    if (!session?.user?.id || !file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload/video", {
        method: "POST",
        body: formData,
      });
      const { url } = await uploadRes.json();

      await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url1080p: url }),
      });

      setIsOpen(false);
      setFile(null);
      setPreview(null);
    } catch (err) {
      console.error("Ошибка:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="fixed bottom-10 right-10">
        <PlusCircleIcon
          onClick={() => setIsOpen(true)}
          className="w-11 h-11 text-(--text-primary) cursor-pointer hover:opacity-70 transition-opacity"
        />
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-primary) p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-(--text-primary)">
                {tr.newReel}
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="text-(--text-primary)/40 hover:text-(--text-primary) transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {preview ? (
              <video
                src={preview}
                controls
                muted
                className="w-full h-64 rounded-xl"
              />
            ) : (
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full aspect-video rounded-xl border border-dashed border-(--border) bg-(--bg-secondary) flex items-center justify-center text-xs text-(--text-primary)/30"
              >
                {tr.clickToSelectVideo}
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setPreview(URL.createObjectURL(f));
              }}
            />

            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="w-full py-2.5 rounded-xl bg-(--bg-card) text-(--text-primary) text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-colors disabled:opacity-30"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  {tr.uploading}
                </span>
              ) : (
                tr.postReel
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateReel;
