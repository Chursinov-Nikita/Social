"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/context/auth";
import type {
  Friendship,
  Tab,
  SearchUser,
  FriendToRemove,
} from "@/app/types/friends";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

const Friends = () => {
  const { user } = useAuth();
  const { lang } = useLang();
  const tr = t[lang];
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendToRemove | null>(
    null,
  );
  const [removingFriend, setRemovingFriend] = useState(false);
  const friendsCacheKey = user ? `friends-cache:${user.id}` : null;
  const requestsCacheKey = user ? `friend-requests-cache:${user.id}` : null;

  const persistFriends = useCallback(
    (value: Friendship[]) => {
      if (!friendsCacheKey) return;
      localStorage.setItem(friendsCacheKey, JSON.stringify(value));
    },
    [friendsCacheKey],
  );

  const persistRequests = useCallback(
    (value: Friendship[]) => {
      if (!requestsCacheKey) return;
      localStorage.setItem(requestsCacheKey, JSON.stringify(value));
    },
    [requestsCacheKey],
  );

  const loadFriends = useCallback(async () => {
    if (!user) return;
    const { data } = (await supabase
      .from("friendships")
      .select("*, profiles:sender_id (id, username, avatar_url)")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)) as {
      data: Friendship[] | null;
    };
    if (data) {
      setFriends(data);
      persistFriends(data);
    }
  }, [user, supabase, persistFriends]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const { data } = (await supabase
      .from("friendships")
      .select("*, profiles:sender_id (id, username, avatar_url)")
      .eq("receiver_id", user.id)
      .eq("status", "pending")) as { data: Friendship[] | null };
    if (data) {
      setRequests(data);
      persistRequests(data);
    }
  }, [user, supabase, persistRequests]);

  useEffect(() => {
    if (!friendsCacheKey || !requestsCacheKey) return;
    const cachedFriends = localStorage.getItem(friendsCacheKey);
    const cachedFriendsParsed = cachedFriends
      ? (() => {
          try {
            return JSON.parse(cachedFriends) as Friendship[];
          } catch {
            localStorage.removeItem(friendsCacheKey);
            return null;
          }
        })()
      : null;
    const cachedRequests = localStorage.getItem(requestsCacheKey);
    const cachedRequestsParsed = cachedRequests
      ? (() => {
          try {
            return JSON.parse(cachedRequests) as Friendship[];
          } catch {
            localStorage.removeItem(requestsCacheKey);
            return null;
          }
        })()
      : null;
    const timer = window.setTimeout(() => {
      if (cachedFriendsParsed) setFriends(cachedFriendsParsed);
      if (cachedRequestsParsed) setRequests(cachedRequestsParsed);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [friendsCacheKey, requestsCacheKey]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void loadFriends();
      void loadRequests();
    }, 0);
    const channel = supabase
      .channel("friendships-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships" },
        (payload: RealtimePostgresChangesPayload<{ receiver_id: string }>) => {
          if ((payload.new as { receiver_id: string }).receiver_id === user.id)
            loadRequests();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "friendships" },
        () => {
          loadFriends();
          loadRequests();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "friendships" },
        () => {
          loadFriends();
          loadRequests();
        },
      )
      .subscribe(() => {});
    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, loadFriends, loadRequests, supabase]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${searchQuery}%`)
      .neq("id", user?.id ?? "")
      .limit(10);
    if (data && user) {
      const ids = data.map((u: { id: string }) => u.id);
      let relationMap = new Map<string, SearchUser["relationStatus"]>();
      if (ids.length > 0) {
        const { data: relations } = await supabase
          .from("friendships")
          .select("sender_id, receiver_id, status")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.in.(${ids.join(",")})),and(sender_id.in.(${ids.join(",")}),receiver_id.eq.${user.id})`,
          );
        relationMap = new Map(
          (relations ?? []).map(
            (r: { sender_id: string; receiver_id: string; status: string }) => {
              const counterpart =
                r.sender_id === user.id ? r.receiver_id : r.sender_id;
              const status =
                r.status === "accepted"
                  ? "accepted"
                  : r.status === "pending"
                    ? "pending"
                    : "none";
              return [counterpart, status];
            },
          ),
        );
      }
      setSearchResults(
        data.map((u: { id: string; username: string }) => ({
          ...u,
          relationStatus: relationMap.get(u.id) ?? "none",
        })),
      );
    }
    setLoading(false);
  };

  const sendRequest = async (receiverId: string) => {
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id})`,
      )
      .maybeSingle();
    if (existing) {
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === receiverId
            ? {
                ...u,
                relationStatus: existing.status as SearchUser["relationStatus"],
              }
            : u,
        ),
      );
      return;
    }
    const { error } = await supabase
      .from("friendships")
      .insert({
        sender_id: user?.id,
        receiver_id: receiverId,
        status: "pending",
      });
    if (!error)
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === receiverId ? { ...u, relationStatus: "pending" } : u,
        ),
      );
  };

  const acceptRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    if (error) return;
    const nextRequests = requests.filter((r) => r.id !== friendshipId);
    const accepted = requests.find((r) => r.id === friendshipId);
    const nextFriends = accepted
      ? [
          ...friends,
          { ...accepted, status: "accepted" as Friendship["status"] },
        ]
      : friends;
    setRequests(nextRequests);
    setFriends(nextFriends);
    persistRequests(nextRequests);
    persistFriends(nextFriends);
  };

  const rejectRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);
    if (error) return;
    const nextRequests = requests.filter((r) => r.id !== friendshipId);
    setRequests(nextRequests);
    persistRequests(nextRequests);
  };

  const removeFriend = async () => {
    if (!friendToRemove || removingFriend) return;
    setRemovingFriend(true);
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendToRemove.id);
    setRemovingFriend(false);
    if (error) return;
    const nextFriends = friends.filter((f) => f.id !== friendToRemove.id);
    setFriends(nextFriends);
    persistFriends(nextFriends);
    setFriendToRemove(null);
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

        <div className="flex gap-1 bg-(--bg-secondary) rounded-xl p-1 mb-6">
          {tabs.map((tab_item) => (
            <button
              key={tab_item.id}
              onClick={() => setTab(tab_item.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${tab === tab_item.id ? "bg-(--bg-card) text-(--text-primary)" : "text-(--text-primary)/40 hover:text-(--text-primary)"}`}
            >
              {tab_item.label}
              {tab_item.count !== undefined && tab_item.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${tab === tab_item.id ? "bg-(--text-primary)/10" : "bg-(--text-primary)/5"}`}
                >
                  {tab_item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "friends" && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-12 text-(--text-primary)/20 text-sm">
                {tr.noFriendsYet}
              </div>
            ) : (
              friends.map((f) => {
                const profile = f.profiles;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-(--bg-secondary)"
                  >
                    <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                      {profile?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--text-primary) truncate">
                        {profile?.username}
                      </p>
                      <p className="text-xs text-(--text-primary)/30">
                        {tr.friend}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setFriendToRemove({
                          id: f.id,
                          username: profile?.username,
                        })
                      }
                      className="text-xs text-(--text-primary)/30 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                    >
                      {tr.remove}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-(--text-primary)/20 text-sm">
                {tr.noPendingRequests}
              </div>
            ) : (
              requests.map((r) => {
                const profile = r.profiles;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-(--bg-secondary)"
                  >
                    <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                      {profile?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--text-primary) truncate">
                        {profile?.username}
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
                );
              })
            )}
          </div>
        )}

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
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-(--bg-card) hover:opacity-80 text-sm font-medium text-(--text-primary) transition-colors disabled:opacity-50"
              >
                {loading ? "..." : tr.search}
              </button>
            </div>
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-(--bg-secondary)"
                >
                  <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {u.username}
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

      {friendToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-(--text-primary)">
              {tr.removeFriend}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {friendToRemove.username
                ? `${tr.removeFriendDesc} ${friendToRemove.username} ${tr.removeFriendDescEnd}`
                : `${tr.removeFriendDesc} ${tr.removeFriendDescEnd}`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setFriendToRemove(null)}
                disabled={removingFriend}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:text-(--text-primary) hover:bg-(--bg-card) transition-colors disabled:opacity-60"
              >
                {tr.cancel}
              </button>
              <button
                onClick={() => removeFriend()}
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
