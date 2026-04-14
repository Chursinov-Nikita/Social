"use client";

import { useState } from "react";
import { ChatUser } from "@/app/types/chat";
import UserList from "@/app/components/chat/UserList";
import ChatWindow from "@/app/components/chat/ChatWindow";

const ChatPage = () => {
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 h-[calc(100vh-5rem)] flex flex-col">
        <div className="flex-1 flex rounded-xl overflow-hidden min-h-0 border border-white/5">
          {/* Список пользователей */}
          <div className="w-64 bg-[#2c2c2e] border-r border-white/5 shrink-0">
            <UserList onSelect={setSelectedUser} selected={selectedUser} />
          </div>

          {/* Окно чата */}
          <div className="flex-1 bg-[#1c1c1e]">
            {selectedUser ? (
              <ChatWindow recipient={selectedUser} />
            ) : (
              <div className="h-full flex items-center justify-center text-white/20 text-sm">
                Select a user to start chatting
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
