"use client";

import { useAuth } from "@/app/context/auth";
import { useLang } from "@/app/context/language";
import { createClient } from "@/app/lib/supabase/client";
import { t } from "@/app/translation/translation";
import { PlusCircleIcon } from "lucide-react";
import { useRef, useState } from "react";

const CreateReel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();
  const tr = t[lang];
  const { user } = useAuth();
  const supabase = createClient();

  const handleUploadVideo = async () => {
    if (!user || !file) return;
    setLoading(true);
    try {
      console.log("1. Начало загрузки", file.name, file.size, file.type);

      const fileName = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      console.log("2. Имя файла:", fileName);

      const { error } = await supabase.storage
        .from("videos")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      console.log("3. Storage результат:", error ?? "успех");
      if (error) throw new Error(error.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("videos").getPublicUrl(fileName);
      console.log("4. Public URL:", publicUrl);

      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        video_url: publicUrl,
        title: title,
        description: description,
      });

      console.log("5. DB результат:", dbError ?? "успех");
      if (dbError) throw new Error(dbError.message);

      console.log("6. Всё готово");
      setIsOpen(false);
      setFile(null);
      setPreview(null);
      setTitle("");
      setDescription("");
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
            className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 space-y-4"
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

            {preview && (
              <video
                src={preview}
                controls
                muted
                className="w-full h-64 rounded-xl"
              />
            )}

            {!preview && (
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full aspect-video rounded-xl border border-dashed border-(--border) bg-(--bg-primary) flex items-center justify-center text-xs text-(--text-primary)/30"
              >
                {tr.clickToSelectVideo}
              </button>
            )}

            <input
              ref={inputRef}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setPreview(URL.createObjectURL(f));
              }}
              type="file"
              accept="video/*"
              className="hidden"
            />

            <input
              type="text"
              value={title ?? ""}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr.titleOptional}
              className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none transition-colors"
            />

            <input
              type="text"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr.descriptionOptional}
              className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none transition-colors"
            />

            <button
              onClick={handleUploadVideo}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-(--bg-card) text-(--text-primary) text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-colors"
            >
              {loading ? tr.loading : tr.postReel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateReel;
