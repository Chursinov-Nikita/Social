"use client";

import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type {
  Friendship,
  SearchUser,
  Tab,
  FriendToRemove,
} from "@/app/types/friends";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const Avatar = ({
  user,
}: {
  user: { name: string | null; image: string | null };
}) =>
  user.image ? (
    <Image
      src={user.image}
      width={40}
      height={40}
      className="rounded-full object-cover w-10 h-10 shrink-0"
      alt={user.name ?? ""}
    />
  ) : (
    <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
      {(user.name ?? "?")[0].toUpperCase()}
    </div>
  );

const Friends = () => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];

  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendToRemove | null>(
    null,
  );
  const [removingFriend, setRemovingFriend] = useState(false);

  const loadFriends = useCallback(async () => {
    const [fr, rq] = await Promise.all([
      fetch("/api/friends").then((r) => r.json()),
      fetch("/api/friends/requests").then((r) => r.json()),
    ]);
    setFriends(fr);
    setRequests(rq);
  }, []);

  useEffect(() => {
    if (session?.user?.id) void loadFriends();
  }, [session?.user?.id, loadFriends]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const res = await fetch(
      `/api/friends/search?q=${encodeURIComponent(searchQuery)}`,
    );
    setSearchResults(await res.json());
    setSearching(false);
  };

  const sendRequest = async (receiverId: string) => {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId }),
    });
    setSearchResults((prev) =>
      prev.map((u) =>
        u.id === receiverId ? { ...u, relationStatus: "pending" as const } : u,
      ),
    );
  };

  const acceptRequest = async (id: string) => {
    await fetch(`/api/friends/${id}`, { method: "PATCH" });
    const accepted = requests.find((r) => r.id === id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    if (accepted)
      setFriends((prev) => [...prev, { ...accepted, status: "accepted" }]);
  };

  const rejectRequest = async (id: string) => {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const removeFriend = async () => {
    if (!friendToRemove || removingFriend) return;
    setRemovingFriend(true);
    await fetch(`/api/friends/${friendToRemove.id}`, { method: "DELETE" });
    setFriends((prev) => prev.filter((f) => f.id !== friendToRemove.id));
    setFriendToRemove(null);
    setRemovingFriend(false);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: tr.friendsTab, count: friends.length },
    { id: "requests", label: tr.requestsTab, count: requests.length },
    { id: "search", label: tr.findPeople },
  ];

  return (
    <div className="min-h-screen bg-(--bg-primary) text-(--text-primary)">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-(--text-primary)">
            {tr.friendsTitle}
          </h1>
          <p className="text-(--text-primary)/40 text-sm mt-0.5">
            {tr.manageConnections}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-(--bg-secondary) rounded-xl p-1 mb-6">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === item.id ? "bg-(--bg-card) text-(--text-primary)" : "text-(--text-primary)/40 hover:text-(--text-primary)"}`}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-(--text-primary)/10">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Friends */}
        {tab === "friends" && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-12 text-(--text-primary)/20 text-sm">
                {tr.noFriendsYet}
              </div>
            ) : (
              friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-(--bg-secondary)"
                >
                  <Avatar user={f.sender} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {f.sender.name}
                    </p>
                    <p className="text-xs text-(--text-primary)/30">
                      {tr.friend}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setFriendToRemove({ id: f.id, name: f.sender.name })
                    }
                    className="text-xs text-(--text-primary)/30 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                  >
                    {tr.remove}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Requests */}
        {tab === "requests" && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-(--text-primary)/20 text-sm">
                {tr.noPendingRequests}
              </div>
            ) : (
              requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-(--bg-secondary)"
                >
                  <Avatar user={r.sender} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {r.sender.name}
                    </p>
                    <p className="text-xs text-(--text-primary)/30">
                      {tr.wantsToBeFriends}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(r.id)}
                      className="text-xs text-(--text-primary) font-medium px-3 py-1.5 rounded-lg bg-(--bg-card) hover:opacity-80 transition-colors"
                    >
                      {tr.accept}
                    </button>
                    <button
                      onClick={() => rejectRequest(r.id)}
                      className="text-xs text-(--text-primary)/40 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      {tr.decline}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search */}
        {tab === "search" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={tr.searchByUsername}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 bg-(--bg-secondary) border border-(--border) focus:border-(--text-primary)/20 rounded-xl px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 rounded-xl bg-(--bg-card) hover:opacity-80 text-sm font-medium text-(--text-primary) transition-colors disabled:opacity-50"
              >
                {searching ? "..." : tr.search}
              </button>
            </div>
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-(--bg-secondary)"
                >
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {u.name}
                    </p>
                  </div>
                  <button
                    onClick={() => sendRequest(u.id)}
                    disabled={u.relationStatus !== "none"}
                    className="text-xs text-(--text-primary) font-medium px-3 py-1.5 rounded-lg bg-(--bg-card) hover:opacity-80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {u.relationStatus === "pending"
                      ? tr.requestSent
                      : u.relationStatus === "accepted"
                        ? tr.alreadyFriends
                        : tr.addFriend}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Remove modal */}
      {friendToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-(--text-primary)">
              {tr.removeFriend}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {tr.removeFriendDesc} {friendToRemove.name}{" "}
              {tr.removeFriendDescEnd}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setFriendToRemove(null)}
                disabled={removingFriend}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors disabled:opacity-60"
              >
                {tr.cancel}
              </button>
              <button
                onClick={removeFriend}
                disabled={removingFriend}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-60"
              >
                {removingFriend ? tr.removing : tr.remove}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;
