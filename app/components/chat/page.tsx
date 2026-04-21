"use client";

import { useState } from "react";
import { ChatUser } from "@/app/types/chat";
import UserList from "@/app/components/chat/UserList";
import ChatWindow from "@/app/components/chat/ChatWindow";

const Chat = () => {
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);

  return (
    <div className="min-h-screen bg-(--bg-primary) text-(--text-primary)">
      <div className="max-w-5xl mx-auto px-4 py-6 h-[calc(100vh-5rem)] flex flex-col">
        <div className="flex-1 flex rounded-xl overflow-hidden min-h-0 border border-(--border)">
          <div className="w-64 bg-(--bg-secondary) border-r border-(--border) shrink-0">
            <UserList onSelect={setSelectedUser} selected={selectedUser} />
          </div>
          <div className="flex-1 bg-(--bg-secondary)">
            {selectedUser ? (
              <ChatWindow key={selectedUser.id} recipient={selectedUser} />
            ) : (
              <div className="h-full flex items-center justify-center text-(--text-primary)/20 text-sm">
                Select a user to start chatting
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
