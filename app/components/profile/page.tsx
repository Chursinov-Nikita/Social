"use client";

import LogOut from "@/app/components/logout/page";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import { Camera, Copy, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserPost, UserReel } from "../../types/profile";
import Empty from "./Empty";
import PostCard from "./PostCard";
import ReelCard from "./ReelCard";

const Profile = () => {
  const { data: session, status, update } = useSession();
  const { lang } = useLang();
  const tr = t[lang];
  const router = useRouter();

  const [posts, setPosts] = useState<UserPost[]>([]);
  const [reels, setReels] = useState<UserReel[]>([]);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"reels" | "posts">("reels");
  const [emailCopied, setEmailCopied] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const user = session?.user;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/components/login");
  }, [status, router]);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? user.email?.split("@")[0] ?? "");
    setNameDraft(user.name ?? user.email?.split("@")[0] ?? "");

    const load = async () => {
      const [postsRes, reelsRes] = await Promise.all([
        fetch("/api/profile/posts"),
        fetch("/api/profile/reels"),
      ]);
      setPosts(await postsRes.json());
      setReels(await reelsRes.json());
    };
    void load();
  }, [user]);

  if (status === "loading" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--border) border-t-(--text-primary)/60" />
      </div>
    );
  }

  const postsCount = posts.length;
  const reelsCount = reels.length;
  const initials = (name || user.email || "?")[0].toUpperCase();
  const currentLevel = Math.floor(postsCount / 5) + 1;
  const nextLevelAt = Math.ceil((postsCount + 1) / 5) * 5;
  const prevLevelAt = Math.max(nextLevelAt - 5, 0);
  const levelProgress = Math.min(
    100,
    Math.round(
      ((postsCount - prevLevelAt) / Math.max(nextLevelAt - prevLevelAt, 1)) *
        100,
    ),
  );
  const achievement =
    postsCount >= 10
      ? tr.achievementCreatorPro
      : postsCount >= 5
        ? tr.achievementRisingVoice
        : postsCount > 0
          ? tr.achievementFirstSteps
          : tr.achievementNewExplorer;

  const handleCopyEmail = async () => {
    if (!user.email) return;
    await navigator.clipboard.writeText(user.email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 1400);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        await update({ image: data.url });
      }
    } catch (err) {
      console.error("Ошибка загрузки аватара:", err);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSaveName = async () => {
    const next = nameDraft.trim();
    if (next.length < 2) {
      setNameError(tr.nicknameTooShort);
      return;
    }
    if (next.length > 30) {
      setNameError(tr.nicknameTooLong);
      return;
    }
    if (next === name) {
      setNameMessage(tr.nicknameAlreadyUpToDate);
      return;
    }

    setNameSaving(true);
    setNameError(null);
    setNameMessage(null);

    const res = await fetch("/api/profile/name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });

    if (!res.ok) {
      const data = await res.json();
      setNameError(data.error ?? "Ошибка");
      setNameSaving(false);
      return;
    }

    setName(next);
    setNameMessage(tr.nicknameUpdated);
    setIsModalOpen(false);
    setNameSaving(false);
  };

  return (
    <div className="min-h-screen bg-(--bg-primary) text-(--text-primary) antialiased">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-(--border) bg-(--bg-secondary) p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            {/* Аватар с загрузкой */}
            <label className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-(--border) bg-(--bg-card) text-lg font-semibold text-(--text-primary)/60 overflow-hidden group">
              {user.image ? (
                <Image
                  src={user.image}
                  width={56}
                  height={56}
                  className="rounded-xl object-cover w-14 h-14"
                  alt="avatar"
                />
              ) : (
                initials
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                {avatarLoading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={avatarLoading}
              />
            </label>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-(--text-primary)">
                {name || tr.noName}
              </p>
              <p className="truncate text-xs text-(--text-primary)/30">
                {user.email}
              </p>
              <p className="mt-2 inline-block rounded-md border border-(--border) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-(--text-primary)/30">
                {achievement}
              </p>
            </div>

            <button
              onClick={() => {
                setNameDraft(name);
                setNameError(null);
                setNameMessage(null);
                setIsModalOpen(true);
              }}
              className="rounded-lg border border-(--border) bg-(--bg-card) px-5 py-1 text-[10px] font-semibold uppercase tracking-wider text-(--text-primary)/80 transition hover:opacity-80"
            >
              {tr.changeNickname}
            </button>
          </div>

          {/* Copy email */}
          <button
            onClick={handleCopyEmail}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--border) px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-(--text-primary)/60 transition hover:bg-(--bg-card) hover:text-(--text-primary)"
          >
            <Copy size={14} strokeWidth={1.5} />
            {emailCopied ? tr.copied : tr.copyEmail}
          </button>

          {/* Stats */}
          <div className="grid grid-cols-2 divide-x divide-(--border) rounded-xl border border-(--border)">
            {[
              { value: reelsCount, label: tr.reels },
              { value: postsCount, label: tr.posts },
            ].map(({ value, label }) => (
              <div key={label} className="p-3 text-center">
                <p className="tabular-nums text-lg font-semibold text-(--text-primary)">
                  {value}
                </p>
                <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-(--text-primary)/30">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Level */}
          <div className="rounded-xl border border-(--border) p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-(--text-primary)/60">
                {tr.level} {currentLevel}
              </span>
              <span className="text-xs tabular-nums text-(--text-primary)/30">
                {postsCount} / {nextLevelAt} {tr.posts}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-(--border)">
              <div
                className="h-full bg-(--text-primary)/40 transition-[width] duration-300"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-(--text-primary)/30">
              {tr.levelDesc}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-(--border)">
            {(["reels", "posts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 border-b-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === tab
                    ? "border-(--text-primary) text-(--text-primary)"
                    : "border-transparent text-(--text-primary)/30 hover:text-(--text-primary)/60"
                }`}
              >
                {tab === "reels" ? tr.myReels : tr.myPosts}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === "reels" ? (
            reels.length ? (
              <div className="grid grid-cols-3 gap-1.5 max-h-96 overflow-auto [scrollbar-width:none]">
                {reels.map((r) => (
                  <ReelCard key={r.id} reel={r} />
                ))}
              </div>
            ) : (
              <Empty label={tr.noReelsYet} />
            )
          ) : posts.length ? (
            <div className="max-h-80 space-y-2 overflow-auto pr-1 [scrollbar-width:thin]">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} tr={tr} />
              ))}
            </div>
          ) : (
            <Empty label={tr.noPostsYet} />
          )}

          <div className="h-px bg-(--border)" />
          <LogOut />
        </div>
      </div>

      {/* Name modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => {
            if (!nameSaving) setIsModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-sm font-semibold text-(--text-primary)">
              {tr.changeNicknameTitle}
            </p>
            <p className="mb-4 text-xs text-(--text-primary)/40">
              {tr.changeNicknameDesc}
            </p>
            <input
              type="text"
              value={nameDraft}
              maxLength={30}
              placeholder={tr.enterNickname}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setNameError(null);
                setNameMessage(null);
              }}
              className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none transition focus:border-(--text-primary)/30"
            />
            {nameError && (
              <p className="mt-2 text-xs text-red-400">{nameError}</p>
            )}
            {!nameError && nameMessage && (
              <p className="mt-2 text-xs text-emerald-500">{nameMessage}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={nameSaving}
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-(--border) px-4 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-primary)/60 transition hover:bg-(--bg-card) disabled:opacity-50"
              >
                {tr.cancel}
              </button>
              <button
                onClick={handleSaveName}
                disabled={nameSaving}
                className="rounded-xl border border-(--border) bg-(--bg-card) px-4 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-primary)/80 transition hover:opacity-80 disabled:opacity-50"
              >
                {nameSaving ? tr.saving : tr.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
