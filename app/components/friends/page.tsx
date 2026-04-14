"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/context/auth";
import type { Friendship } from "@/app/types/friends";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Tab = "friends" | "requests" | "search";

export default function FriendsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; username: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    const { data } = (await supabase
      .from("friendships")
      .select("*, profiles:sender_id (id, username, avatar_url)")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)) as {
      data: Friendship[] | null;
    };
    if (data) setFriends(data);
  }, [user, supabase]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const { data } = (await supabase
      .from("friendships")
      .select("*, profiles:sender_id (id, username, avatar_url)")
      .eq("receiver_id", user.id)
      .eq("status", "pending")) as { data: Friendship[] | null };
    if (data) setRequests(data);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;

    loadFriends();
    loadRequests();

    const channel = supabase
      .channel("friendships-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships" },
        (payload: RealtimePostgresChangesPayload<{ receiver_id: string }>) => {
          const newRow = payload.new as { receiver_id: string };
          if (newRow.receiver_id === user.id) {
            loadRequests();
          }
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
    if (data) setSearchResults(data);
    setLoading(false);
  };

  const sendRequest = async (receiverId: string) => {
    // Проверяем не существует ли уже запрос
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id})`,
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") {
        alert("Request already sent");
      } else if (existing.status === "accepted") {
        alert("Already friends");
      }
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      sender_id: user?.id,
      receiver_id: receiverId,
      status: "pending",
    });

    if (!error) {
      setSearchResults((prev) => prev.filter((u) => u.id !== receiverId));
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    loadRequests();
    loadFriends();
  };

  const rejectRequest = async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    loadRequests();
  };

  const removeFriend = async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    loadFriends();
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "friends", label: "Friends", count: friends.length },
    { id: "requests", label: "Requests", count: requests.length },
    { id: "search", label: "Find People" },
  ];

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">Friends</h1>
          <p className="text-white/30 text-sm mt-0.5">
            Manage your connections
          </p>
        </div>

        <div className="flex gap-1 bg-[#2c2c2e] rounded-xl p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${tab === t.id ? "bg-[#3a3a3c] text-white" : "text-white/40 hover:text-white"}`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-white/10" : "bg-white/5"}`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "friends" && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-12 text-white/20 text-sm">
                No friends yet — find people in the search tab
              </div>
            ) : (
              friends.map((f) => {
                const profile = f.profiles;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#2c2c2e]"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold shrink-0">
                      {profile?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {profile?.username}
                      </p>
                      <p className="text-xs text-white/30">Friend</p>
                    </div>
                    <button
                      onClick={() => removeFriend(f.id)}
                      className="text-xs text-white/30 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                    >
                      Remove
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
              <div className="text-center py-12 text-white/20 text-sm">
                No pending requests
              </div>
            ) : (
              requests.map((r) => {
                const profile = r.profiles;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#2c2c2e]"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold shrink-0">
                      {profile?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {profile?.username}
                      </p>
                      <p className="text-xs text-white/30">
                        Wants to be friends
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRequest(r.id)}
                        className="text-xs text-white font-medium px-3 py-1.5 rounded-lg bg-[#3a3a3c] hover:bg-[#48484a] transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => rejectRequest(r.id)}
                        className="text-xs text-white/40 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        Decline
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
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 bg-[#2c2c2e] border border-white/5 focus:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-[#3a3a3c] hover:bg-[#48484a] text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Search"}
              </button>
            </div>
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#2c2c2e]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold shrink-0">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {u.username}
                    </p>
                  </div>
                  <button
                    onClick={() => sendRequest(u.id)}
                    className="text-xs text-white font-medium px-3 py-1.5 rounded-lg bg-[#3a3a3c] hover:bg-[#48484a] transition-colors"
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
