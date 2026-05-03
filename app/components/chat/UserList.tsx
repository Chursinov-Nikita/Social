"use client";

import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { ChatUser, MessagePreview } from "@/app/types/chat";
import Image from "next/image";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

type Props = {
  onSelect: (user: ChatUser) => void;
  selected: ChatUser | null;
};

const UserList = ({ onSelect, selected }: Props) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [previews, setPreviews] = useState<Record<string, MessagePreview>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});

  const loadPreviews = async () => {
    const res = await fetch("/api/chat/previews");
    const data = await res.json();
    setPreviews(data.previews ?? {});
    setUnread(data.unread ?? {});
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/chat/users")
      .then((r) => r.json())
      .then(setUsers);

    loadPreviews();

    socket.emit("join", session.user.id);
    socket.on("new_message", loadPreviews);
    socket.on("message_read", loadPreviews);

    return () => {
      socket.off("new_message", loadPreviews);
      socket.off("message_read", loadPreviews);
    };
  }, [session?.user?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-(--border)">
        <p className="text-sm font-semibold text-(--text-primary)">
          {tr.messages}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {users.length === 0 ? (
          <div className="text-center py-8 text-(--text-primary)/20 text-xs">
            No chats yet
          </div>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 ${selected?.id === u.id ? "bg-(--bg-card)" : "hover:bg-(--bg-secondary)"}`}
            >
              {u.image ? (
                <Image
                  src={u.image}
                  width={40}
                  height={40}
                  className="rounded-full object-cover w-10 h-10 shrink-0"
                  alt={u.name ?? ""}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                  {(u.name ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div className="text-left min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-(--text-primary) truncate">
                    {u.name}
                  </p>
                  {(unread[u.id] ?? 0) > 0 && (
                    <span className="w-4 h-4 bg-(--bg-card) text-(--text-primary)/80 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {unread[u.id] > 9 ? "9+" : unread[u.id]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-(--text-primary)/30 truncate">
                  {previews[u.id]?.content ?? tr.clickToChat}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default UserList;
