"use client";

import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { ChatUser } from "@/app/types/chat";
import { useState } from "react";
import ChatWindow from "./ChatWindow";
import UserList from "./UserList";
import GroupChatWindow from "./GroupChatWindow";

const Chat = () => {
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const { lang } = useLang();
  const tr = t[lang];

  return (
    <div className="fixed inset-0 flex flex-col bg-(--bg-primary) text-(--text-primary) top-14">
      <div className="flex-1 flex overflow-hidden min-h-0">
        <aside className="w-110 shrink-0 overflow-y-auto bg-(--bg-primary) border-r border-(--border)">
          <UserList
            onGroupLeft={() => setSelectedUser(null)}
            onSelect={setSelectedUser}
            selected={selectedUser}
          />
        </aside>
        <main className="flex-1 min-w-0 bg-(--bg-primary)">
          {selectedUser ? (
            selectedUser.isGroup ? (
              <GroupChatWindow
                key={selectedUser.id}
                groupId={selectedUser.id}
                groupName={selectedUser.name ?? ""}
                groupAvatar={selectedUser.image ?? null}
              />
            ) : (
              <ChatWindow
                key={selectedUser.id}
                recipient={selectedUser}
                onChatDeleted={() => setSelectedUser(null)}
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center text-(--text-primary)/20 text-sm">
              {tr.selectUserToChat}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Chat;
