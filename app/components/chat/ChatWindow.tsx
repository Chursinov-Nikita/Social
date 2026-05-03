"use client";

import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { ChatUser, Message } from "@/app/types/chat";
import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";

const PAGE_SIZE = 50;

const ChatWindow = ({ recipient }: { recipient: ChatUser }) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];
  const currentUserId = session?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Загрузка сообщений
  useEffect(() => {
    if (!currentUserId) return;
    setMessages([]);
    setHasMore(true);

    fetch(`/api/chat/messages?recipientId=${recipient.id}`)
      .then((r) => r.json())
      .then((data: Message[]) => {
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
      });

    // Отметить как прочитанные
    fetch("/api/chat/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: recipient.id }),
    });
  }, [recipient.id, currentUserId]);

  // Socket.io — получение новых сообщений
  useEffect(() => {
    if (!currentUserId) return;

    socket.emit("join", currentUserId);

    const handler = (msg: Message) => {
      const isRelevant =
        (msg.senderId === currentUserId && msg.receiverId === recipient.id) ||
        (msg.senderId === recipient.id && msg.receiverId === currentUserId);
      if (isRelevant && msg.senderId !== currentUserId) {
        setMessages((prev) => [...prev, msg]);
        // Отметить как прочитанное
        fetch("/api/chat/messages/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId: recipient.id }),
        });
      }
    };

    socket.on("new_message", handler);
    return () => {
      socket.off("new_message", handler);
    };
  }, [currentUserId, recipient.id]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadOlder = async () => {
    if (!messages.length || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const cursor = messages[0].createdAt;
    const res = await fetch(
      `/api/chat/messages?recipientId=${recipient.id}&cursor=${cursor}`,
    );
    const older: Message[] = await res.json();
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length === PAGE_SIZE);
    setLoadingOlder(false);
  };

  const sendMessage = async () => {
    if (!content.trim() || !currentUserId) return;
    setLoading(true);

    const optimistic: Message = {
      id: crypto.randomUUID(),
      senderId: currentUserId,
      receiverId: recipient.id,
      content: content.trim(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setContent("");

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: recipient.id,
          content: optimistic.content,
        }),
      });
      const saved: Message = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? saved : m)),
      );
      socket.emit("send_message", saved);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setContent(optimistic.content);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-(--bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-(--border) bg-(--bg-secondary)">
        <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
          {recipient.name?.[0].toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="text-sm font-semibold text-(--text-primary)">
            {recipient.name}
          </p>
          <p className="text-xs text-(--text-primary)/30">{tr.online}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
      >
        {hasMore && (
          <div className="flex justify-center pb-3">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="text-xs px-3 py-1.5 rounded-full bg-(--bg-secondary) text-(--text-primary)/80 hover:bg-(--bg-card) disabled:opacity-40 transition-colors"
            >
              {loadingOlder ? tr.loading : tr.loadOlderMessages}
            </button>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-2xl text-sm leading-relaxed text-(--text-primary) ${isMe ? "bg-(--bg-card) rounded-br-sm" : "bg-(--bg-secondary) rounded-bl-sm"}`}
              >
                <p>{msg.content}</p>
                <p className="text-[10px] mt-1 text-right text-(--text-primary)/30">
                  {new Date(msg.createdAt).toLocaleTimeString("ru", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-(--border) bg-(--bg-secondary)">
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={tr.writeMessage}
            rows={1}
            className="flex-1 bg-(--bg-primary) border border-(--border) focus:border-(--text-primary)/20 rounded-xl px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 resize-none focus:outline-none transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !content.trim()}
            className="p-2.5 rounded-xl bg-(--bg-card) hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <svg
              className="w-5 h-5 ml-1 text-(--text-primary)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              transform="rotate(90)"
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
