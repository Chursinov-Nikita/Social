"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChatUser, Message } from "@/app/types/chat";
import { useAuth } from "@/app/context/auth";
import { createClient } from "@/app/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface ChatWindowProps {
  recipient: ChatUser;
}

const ChatWindow = ({ recipient }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const loadMessages = async () => {
      const { data } = (await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},receiver_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })) as {
        data: Message[] | null;
        error: unknown;
      };

      if (data) setMessages(data);
    };

    loadMessages();
  }, [user, recipient.id, supabase]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-${user.id}-${recipient.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const newMsg = payload.new as Message;
          const isRelevant =
            (newMsg.sender_id === user.id &&
              newMsg.receiver_id === recipient.id) ||
            (newMsg.sender_id === recipient.id &&
              newMsg.receiver_id === user.id);

          if (isRelevant && newMsg.sender_id !== user.id) {
            setMessages((prev) => [...prev, newMsg]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recipient.id, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!content.trim() || !user) return;
    setLoading(true);

    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      sender_id: user.id,
      receiver_id: recipient.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setContent("");

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: recipient.id,
      content: optimisticMsg.content,
    });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setContent(optimisticMsg.content);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#2c2c2e]">
        <div className="w-10 h-10 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold shrink-0 text-white">
          {recipient.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            {recipient.username}
          </p>
          <p className="text-xs text-white/30">online</p>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-2xl text-sm leading-relaxed
                  ${
                    isMe
                      ? "bg-[#3a3a3c] text-white rounded-br-sm"
                      : "bg-[#2c2c2e] text-white rounded-bl-sm"
                  }`}
              >
                <p>{msg.content}</p>
                <p className="text-[10px] mt-1 text-right text-white/30">
                  {new Date(msg.created_at).toLocaleTimeString("ru", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div className="px-4 py-3 border-t border-white/5 bg-[#2c2c2e]">
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            className="flex-1 bg-[#1c1c1e] border border-white/5 focus:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 resize-none focus:outline-none transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !content.trim()}
            className="p-2.5 rounded-xl bg-[#3a3a3c] hover:bg-[#48484a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
