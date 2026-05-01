"use client";

import LogOut from "@/app/components/logout/page";
import { Empty } from "@/app/components/profile/Empty";
import { PostCard } from "@/app/components/profile/Postcard";
import { ReelCard } from "@/app/components/profile/Reelcard";
import { useAuth } from "@/app/context/auth";
import { useLang } from "@/app/context/language";
import { createClient } from "@/app/lib/supabase/client";
import { t } from "@/app/translation/translation";
import { UserPost, UserReels } from "@/app/types/profile";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const Profile = () => {
  const { user, loading } = useAuth();
  const { lang } = useLang();
  const tr = t[lang];
  const router = useRouter();

  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userReels, setUserReels] = useState<UserReels[]>([]);
  const [currentNickname, setCurrentNickname] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"reels" | "posts">(
    "reels",
  );
  const [emailCopied, setEmailCopied] = useState(false);

  // ── Load data ──
  useEffect(() => {
    if (!loading && !user) {
      router.push("/components/login");
      return;
    }
    if (!user) return;

    const supabase = createClient();

    const load = async () => {
      const [postsRes, reelsRes] = await Promise.all([
        supabase
          .from("posts")
          .select(
            "id, content, image_url, likes_count, created_at, comments(count)",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("videos")
          .select(
            "id, title, video_url, views_count, created_at, video_likes(count)",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (postsRes.error) console.error("Posts:", postsRes.error);
      if (reelsRes.error) console.error("Reels:", reelsRes.error);

      setUserPosts(postsRes.data ?? []);
      setUserReels(reelsRes.data ?? []);
    };

    void load();
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const name =
      (user.user_metadata?.name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "";
    const timer = window.setTimeout(() => {
      setCurrentNickname(name);
      setNicknameDraft(name);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

  // ── Early returns ──
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--border) border-t-(--text-primary)/60" />
      </div>
    );
  if (!user) return null;

  // ── Derived values ──
  const postsCount = userPosts.length;
  const reelsCount = userReels.length;
  const initials = (currentNickname || user.email || "?")[0].toUpperCase();
  const nextLevelAt = Math.ceil((postsCount + 1) / 5) * 5;
  const prevLevelAt = Math.max(nextLevelAt - 5, 0);
  const levelProgress = Math.min(
    100,
    Math.round(
      ((postsCount - prevLevelAt) / Math.max(nextLevelAt - prevLevelAt, 1)) *
        100,
    ),
  );
  const currentLevel = Math.floor(postsCount / 5) + 1;
  const achievement =
    postsCount >= 10
      ? tr.achievementCreatorPro
      : postsCount >= 5
        ? tr.achievementRisingVoice
        : postsCount > 0
          ? tr.achievementFirstSteps
          : tr.achievementNewExplorer;

  // ── Handlers ──
  const handleCopyEmail = async () => {
    if (!user.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 1400);
    } catch {
      /* silent */
    }
  };

  const openNicknameModal = () => {
    setNicknameDraft(currentNickname);
    setNicknameError(null);
    setNicknameMessage(null);
    setIsNicknameModalOpen(true);
  };

  const handleSaveNickname = async () => {
    const next = nicknameDraft.trim();
    if (next.length < 2) {
      setNicknameError(tr.nicknameTooShort);
      return;
    }
    if (next.length > 30) {
      setNicknameError(tr.nicknameTooLong);
      return;
    }
    if (next === currentNickname) {
      setNicknameMessage(tr.nicknameAlreadyUpToDate);
      return;
    }

    setNicknameSaving(true);
    setNicknameError(null);
    setNicknameMessage(null);

    const supabase = createClient();

    const { error: authErr } = await supabase.auth.updateUser({
      data: { ...user.user_metadata, name: next },
    });
    if (authErr) {
      setNicknameError(authErr.message);
      setNicknameSaving(false);
      return;
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ username: next })
      .eq("id", user.id);
    if (profileErr) {
      setNicknameError(profileErr.message);
      setNicknameSaving(false);
      return;
    }

    setCurrentNickname(next);
    setNicknameDraft(next);
    setNicknameMessage(tr.nicknameUpdated);
    setIsNicknameModalOpen(false);
    setNicknameSaving(false);
  };

  return (
    <div className="min-h-screen bg-(--bg-primary) text-(--text-primary) antialiased">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-(--border) bg-(--bg-secondary) p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--bg-card) text-lg font-semibold text-(--text-primary)/60">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-(--text-primary)">
                {currentNickname || tr.noName}
              </p>
              <p className="truncate text-xs text-(--text-primary)/30">
                {user.email}
              </p>
              <p className="mt-2 inline-block rounded-md border border-(--border) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-(--text-primary)/30">
                {achievement}
              </p>
            </div>
            <button
              type="button"
              onClick={openNicknameModal}
              className="rounded-lg border border-(--border) bg-(--bg-card) px-5 py-1 text-[10px] font-semibold uppercase tracking-wider text-(--text-primary)/80 transition hover:opacity-80"
            >
              {tr.changeNickname}
            </button>
          </div>

          {/* Copy email */}
          <button
            type="button"
            onClick={handleCopyEmail}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--border) bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-(--text-primary)/60 transition hover:bg-(--bg-card) hover:text-(--text-primary)"
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
            {(["reels", "posts"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSection(s)}
                className={`flex-1 border-b-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider transition
                  ${
                    activeSection === s
                      ? "border-(--text-primary) text-(--text-primary)"
                      : "border-transparent text-(--text-primary)/30 hover:text-(--text-primary)/60"
                  }`}
              >
                {s === "reels" ? tr.myReels : tr.myPosts}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeSection === "reels" ? (
            userReels.length ? (
              <div className="grid grid-cols-3 gap-1.5 max-h-96 overflow-auto [scrollbar-width:none]">
                {userReels.map((reel) => (
                  <ReelCard key={reel.id} reel={reel} />
                ))}
              </div>
            ) : (
              <Empty label={tr.noReelsYet} />
            )
          ) : userPosts.length ? (
            <div className="max-h-80 space-y-2 overflow-auto pr-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
              {userPosts.map((post) => (
                <PostCard key={post.id} post={post} tr={tr} />
              ))}
            </div>
          ) : (
            <Empty label={tr.noPostsYet} />
          )}

          <div className="h-px bg-(--border)" />
          <LogOut />
        </div>
      </div>

      {/* Nickname modal */}
      {isNicknameModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => {
            if (!nicknameSaving) setIsNicknameModalOpen(false);
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
              value={nicknameDraft}
              maxLength={30}
              placeholder={tr.enterNickname}
              onChange={(e) => {
                setNicknameDraft(e.target.value);
                setNicknameError(null);
                setNicknameMessage(null);
              }}
              className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none transition focus:border-(--text-primary)/30"
            />
            {nicknameError && (
              <p className="mt-2 text-xs text-red-400">{nicknameError}</p>
            )}
            {!nicknameError && nicknameMessage && (
              <p className="mt-2 text-xs text-emerald-500">{nicknameMessage}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={nicknameSaving}
                onClick={() => setIsNicknameModalOpen(false)}
                className="rounded-xl border border-(--border) px-4 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-primary)/60 transition hover:bg-(--bg-card) disabled:opacity-50"
              >
                {tr.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveNickname}
                disabled={nicknameSaving}
                className="rounded-xl border border-(--border) bg-(--bg-card) px-4 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-primary)/80 transition hover:opacity-80 disabled:opacity-50"
              >
                {nicknameSaving ? tr.saving : tr.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
