"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/context/auth";
import LogOut from "@/app/components/logout/page";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Copy, Heart, MessageCircle } from "lucide-react";
import { UserPost } from "@/app/types/profile";

const Profile = () => {
  const { user, loading } = useAuth();
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [currentNickname, setCurrentNickname] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "posts">(
    "overview",
  );
  const [emailCopied, setEmailCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/components/login");
      return;
    }
    if (!user) return;

    const supabase = createClient();
    const loadProfilePosts = async () => {
      const { data } = (await supabase
        .from("posts")
        .select(
          "id, content, image_url, likes_count, comments_count, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })) as {
        data: UserPost[] | null;
      };

      if (!data || data.length === 0) {
        setUserPosts([]);
        return;
      }

      const postIds = data.map((post) => post.id);
      const { data: commentsData } = (await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds)) as {
        data: Array<{ post_id: string }> | null;
      };

      const commentsByPost = (commentsData ?? []).reduce<
        Record<string, number>
      >((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] ?? 0) + 1;
        return acc;
      }, {});

      const postsWithActualComments = data.map((post) => ({
        ...post,
        comments_count: commentsByPost[post.id] ?? 0,
      }));

      setUserPosts(postsWithActualComments);
    };

    void loadProfilePosts();
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const nickname =
      (user.user_metadata?.name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "";
    const timer = window.setTimeout(() => {
      setCurrentNickname(nickname);
      setNicknameDraft(nickname);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1c1c1e]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
      </div>
    );
  }

  if (!user) return null;

  const totalLikes = userPosts.reduce(
    (sum, post) => sum + (post.likes_count ?? 0),
    0,
  );
  const totalComments = userPosts.reduce(
    (sum, post) => sum + (post.comments_count ?? 0),
    0,
  );
  const postsCount = userPosts.length;
  const initials = currentNickname
    ? currentNickname.charAt(0).toUpperCase()
    : user.email?.[0].toUpperCase();
  const topPost = [...userPosts].sort(
    (a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0),
  )[0];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyActivity = weekDays.map((day, index) => {
    const count = userPosts.filter(
      (post) => new Date(post.created_at).getDay() === index,
    ).length;
    return { day, count };
  });
  const maxWeeklyCount = Math.max(...weeklyActivity.map((e) => e.count), 1);
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
      ? "Creator Pro"
      : postsCount >= 5
        ? "Rising Voice"
        : postsCount > 0
          ? "First Steps"
          : "New Explorer";

  const handleCopyEmail = async () => {
    if (!user.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 1400);
    } catch {
      setEmailCopied(false);
    }
  };

  const handleSaveNickname = async () => {
    const nextNickname = nicknameDraft.trim();
    if (nextNickname.length < 2) {
      setNicknameError("Nickname must be at least 2 characters.");
      setNicknameMessage(null);
      return;
    }
    if (nextNickname.length > 30) {
      setNicknameError("Nickname must be 30 characters or less.");
      setNicknameMessage(null);
      return;
    }
    if (nextNickname === currentNickname) {
      setNicknameMessage("Nickname is already up to date.");
      setNicknameError(null);
      return;
    }

    setNicknameSaving(true);
    setNicknameError(null);
    setNicknameMessage(null);
    const supabase = createClient();

    const { error: authError } = await supabase.auth.updateUser({
      data: { ...user.user_metadata, name: nextNickname },
    });

    if (authError) {
      setNicknameError(authError.message);
      setNicknameSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ username: nextNickname })
      .eq("id", user.id);

    if (profileError) {
      setNicknameError(profileError.message);
      setNicknameSaving(false);
      return;
    }

    setCurrentNickname(nextNickname);
    setNicknameDraft(nextNickname);
    setNicknameMessage("Nickname updated.");
    setIsNicknameModalOpen(false);
    setNicknameSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white antialiased">
      <div className="mx-auto flex w-full max-w-2xl justify-center px-4 py-10">
        <div className="w-full space-y-3">
          <div className="rounded-2xl border border-white/5 bg-[#2c2c2e] p-6">
            {/* Аватар + инфо */}
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-[#3a3a3c] text-lg font-semibold text-white/60">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {currentNickname || "No name"}
                </p>
                <p className="truncate text-xs text-white/30">{user.email}</p>
                <p className="mt-2 inline-block rounded-md border border-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/30">
                  {achievement}
                </p>
              </div>
              <div className="">
                <button
                  type="button"
                  onClick={() => {
                    setNicknameDraft(currentNickname);
                    setNicknameError(null);
                    setNicknameMessage(null);
                    setIsNicknameModalOpen(true);
                  }}
                  className="rounded-lg border border-white/10 bg-[#3a3a3c] px-5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 transition hover:bg-[#48484a]"
                >
                  Change nickname
                </button>
              </div>
            </div>

            {/* Статистика */}
            <div className="mb-6 grid grid-cols-3 divide-x divide-white/5 rounded-xl border border-white/5 bg-[#1c1c1e]">
              {[
                { value: postsCount, label: "posts" },
                { value: totalLikes, label: "likes" },
                { value: totalComments, label: "comments" },
              ].map(({ value, label }) => (
                <div key={label} className="p-3 text-center sm:p-4">
                  <p className="tabular-nums text-xl font-semibold text-white">
                    {value}
                  </p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/30">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Copy email */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-white/60 transition hover:bg-[#3a3a3c] hover:text-white"
              >
                <Copy size={14} strokeWidth={1.5} />
                {emailCopied ? "Copied" : "Copy email"}
              </button>
            </div>

            {/* Level */}
            <div className="mb-6 rounded-xl border border-white/5 bg-[#1c1c1e] p-4">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Level {currentLevel}
                </span>
                <span className="text-xs tabular-nums text-white/30">
                  {postsCount} / {nextLevelAt} posts
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-white/40 transition-[width] duration-300"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/30">
                One level per 5 posts you publish. The bar is progress to the
                next level.
              </p>
            </div>

            {/* Tabs */}
            <div className="mb-5 flex border-b border-white/5">
              {(["overview", "posts"] as const).map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => setActiveSection(section)}
                  className={`flex-1 border-b-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider transition
                    ${
                      activeSection === section
                        ? "border-white text-white"
                        : "border-transparent text-white/30 hover:text-white/60"
                    }`}
                >
                  {section === "overview" ? "Overview" : "My posts"}
                </button>
              ))}
            </div>

            {activeSection === "overview" ? (
              <div className="space-y-4 rounded-2xl border border-white/5 bg-[#1c1c1e] p-4">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Top post
                  </span>
                  <span className="text-xs tabular-nums text-white/60">
                    {topPost ? `${topPost.likes_count ?? 0} likes` : "—"}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed text-white/70">
                  {topPost?.content?.trim() ||
                    (topPost?.image_url
                      ? "Image post"
                      : "Add your first post to see a summary here.")}
                </p>
                <div className="border-t border-white/5 pt-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                    Weekly activity
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weeklyActivity.map((entry) => (
                      <div
                        key={entry.day}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="flex h-16 w-full items-end rounded-lg border border-white/5 bg-[#2c2c2e] px-0.5 pb-0.5 pt-1">
                          <div
                            className={`w-full rounded-sm ${entry.count ? "bg-white/40" : "bg-white/5"}`}
                            style={{
                              height: `${Math.max((entry.count / maxWeeklyCount) * 100, entry.count ? 12 : 4)}%`,
                              minHeight: entry.count ? 4 : 2,
                            }}
                            title={`${entry.day}: ${entry.count}`}
                          />
                        </div>
                        <span className="text-[9px] uppercase text-white/30">
                          {entry.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-auto pr-1 [scrollbar-color:rgb(255_255_255/10%)_transparent] [scrollbar-width:thin]">
                {userPosts.length ? (
                  userPosts.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-xl border border-white/5 bg-[#1c1c1e] p-3"
                    >
                      {post.image_url && (
                        <div className="relative mb-3 h-36 overflow-hidden rounded-xl border border-white/5">
                          <Image
                            src={post.image_url}
                            alt="Post image"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      )}
                      <p className="line-clamp-2 text-sm leading-relaxed text-white/70">
                        {post.content?.trim() ||
                          (post.image_url ? "Image post" : "No text")}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-[10px] font-medium uppercase tracking-wider text-white/30">
                        <span className="inline-flex items-center gap-1 text-white/50">
                          <Heart size={11} strokeWidth={1.5} />
                          {post.likes_count ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 text-white/50">
                          <MessageCircle size={11} strokeWidth={1.5} />
                          {post.comments_count ?? 0}
                        </span>
                        <span className="ml-auto tabular-nums">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/5 p-6 text-center text-sm text-white/20">
                    No posts yet.
                  </div>
                )}
              </div>
            )}

            <div className="mb-2 mt-6 h-px bg-white/5" />

            <LogOut />
          </div>
        </div>
      </div>
      {isNicknameModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => {
            if (!nicknameSaving) setIsNicknameModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2c2c2e] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-sm font-semibold text-white">
              Change nickname
            </p>
            <p className="mb-4 text-xs text-white/40">
              Enter a new nickname (2-30 characters).
            </p>
            <input
              type="text"
              value={nicknameDraft}
              onChange={(e) => {
                setNicknameDraft(e.target.value);
                if (nicknameError) setNicknameError(null);
                if (nicknameMessage) setNicknameMessage(null);
              }}
              maxLength={30}
              placeholder="Enter your nickname"
              className="w-full rounded-xl border border-white/10 bg-[#1c1c1e] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-white/30"
            />
            {nicknameError && (
              <p className="mt-2 text-xs text-red-300">{nicknameError}</p>
            )}
            {!nicknameError && nicknameMessage && (
              <p className="mt-2 text-xs text-emerald-300">{nicknameMessage}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={nicknameSaving}
                onClick={() => setIsNicknameModalOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60 transition hover:bg-[#3a3a3c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNickname}
                disabled={nicknameSaving}
                className="rounded-xl border border-white/10 bg-[#3a3a3c] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 transition hover:bg-[#48484a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {nicknameSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
