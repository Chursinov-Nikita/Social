"use client";

import { useAuth } from "@/app/context/auth";
import { createClient } from "@/app/lib/supabase/client";
import { ChatUser } from "@/app/types/chat";
import { useEffect, useState, useMemo } from "react";
import { MessagePreview, UserListProps } from "@/app/types/chat";

const UserList = ({ onSelect, selected }: UserListProps) => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [previews, setPreviews] = useState<Record<string, MessagePreview>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .neq("id", user.id)
      .then(({ data }: { data: ChatUser[] | null }) => {
        if (data) {
          setUsers(
            data.filter(
              (u, i, self) => i === self.findIndex((t) => t.id === u.id),
            ),
          );
        }
      });
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;

    const loadPreviews = async () => {
      const { data } = await supabase
        .from("messages")
        .select("content, created_at, sender_id, receiver_id, read")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!data) return;

      const lastMessages: Record<string, MessagePreview> = {};
      const unreadCounts: Record<string, number> = {};

      data.forEach((msg: MessagePreview) => {
        const companionId =
          msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!lastMessages[companionId]) lastMessages[companionId] = msg;
        if (msg.receiver_id === user.id && !msg.read) {
          unreadCounts[companionId] = (unreadCounts[companionId] ?? 0) + 1;
        }
      });

      setPreviews(lastMessages);
      setUnread(unreadCounts);
    };

    void loadPreviews();

    const channel = supabase
      .channel("userlist-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void loadPreviews(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => void loadPreviews(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-(--border)">
        <p className="text-sm font-semibold text-(--text-primary)">Messages</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150
              ${selected?.id === u.id ? "bg-(--bg-card)" : "hover:bg-(--bg-secondary)"}`}
          >
            <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
              {u.username.charAt(0).toUpperCase()}
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-(--text-primary) truncate">
                  {u.username}
                </p>
                {(unread[u.id] ?? 0) > 0 && (
                  <span className="w-4 h-4 bg-[#4a4a4e] text-white/90 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                    {unread[u.id] > 9 ? "9+" : unread[u.id]}
                  </span>
                )}
              </div>
              <p className="text-xs text-(--text-primary)/30 truncate">
                {previews[u.id]?.content ?? "Click to chat"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default UserList;
