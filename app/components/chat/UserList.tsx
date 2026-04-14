"use client";

import { useAuth } from "@/app/context/auth";
import { createClient } from "@/app/lib/supabase/client";
import { ChatUser } from "@/app/types/chat";
import { useEffect, useState } from "react";

interface UserListProps {
  onSelect: (user: ChatUser) => void;
  selected: ChatUser | null;
}

const UserList = ({ onSelect, selected }: UserListProps) => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .neq("id", user?.id ?? "")
      .then(({ data }: { data: ChatUser[] | null }) => {
        if (data) {
          const unique = data.filter(
            (u, index, self) => index === self.findIndex((t) => t.id === u.id),
          );
          setUsers(unique);
        }
      });
  }, [supabase, user]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/5">
        <p className="text-sm font-semibold text-white">Messages</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150
              ${selected?.id === u.id ? "bg-[#3a3a3c]" : "hover:bg-[#2c2c2e]"}`}
          >
            <div className="w-10 h-10 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold shrink-0 text-white">
              {u.username.charAt(0).toUpperCase()}
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {u.username}
              </p>
              <p className="text-xs text-white/30 truncate">Click to chat</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default UserList;
