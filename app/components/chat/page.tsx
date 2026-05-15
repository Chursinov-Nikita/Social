"use client";

import { useState } from "react";
import type { ChatUser } from "@/app/types/chat";
import UserList from "./UserList";
import ChatWindow from "./ChatWindow";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

const Chat = () => {
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const { lang } = useLang();
  const tr = t[lang];

  return (
    <div className="min-h-screen bg-(--bg-primary) text-(--text-primary) fixed top-15 w-full">
      <div className="max-w-5xl mx-auto px-4 py-6 h-[calc(100vh-5rem)] flex flex-col">
        <div className="flex-1 flex rounded-xl overflow-hidden min-h-0 border border-(--border)">
          <div className="w-64 bg-(--bg-secondary) border-r border-(--border) shrink-0">
            <UserList onSelect={setSelectedUser} selected={selectedUser} />
          </div>
          <div className="flex-1 bg-(--bg-secondary)">
            {selectedUser ? (
              <ChatWindow
                key={selectedUser.id}
                recipient={selectedUser}
                onChatDeleted={() => setSelectedUser(null)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-(--text-primary)/20 text-sm">
                {tr.selectUserToChat}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
