"use client";

import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { ChatUser, Message } from "@/app/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import { useE2EE } from "@/app/hooks/useE2EE";
import { DeleteMode } from "@/app/types/chat";
import { EllipsisVertical, Trash2, UserCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 50;

const ChatWindow = ({
  recipient,
  onChatDeleted,
}: {
  recipient: ChatUser;
  onChatDeleted?: () => void;
}) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];
  const currentUserId = session?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { onlineUsers, lastSeen } = useOnlineStatus([recipient.id]);
  const isOnline = onlineUsers.has(recipient.id);
  const { ready, encrypt, decrypt } = useE2EE(recipient.id);

  useEffect(() => {
    if (!currentUserId) return;
    setMessages([]);
    setDecryptedMessages([]);
    setHasMore(true);

    fetch(`/api/chat/messages?recipientId=${recipient.id}`)
      .then((r) => r.json())
      .then((data: Message[]) => {
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
      });

    fetch("/api/chat/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: recipient.id }),
    });
  }, [recipient.id, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/chat/messages?recipientId=${recipient.id}`);
      const data: Message[] = await res.json();
      setMessages(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [recipient.id, currentUserId]);

  const decryptAll = useCallback(
    async (msgs: Message[]) => {
      if (!msgs.length) {
        setDecryptedMessages([]);
        return;
      }
      const result = await Promise.all(
        msgs.map(async (msg) => ({
          ...msg,
          content: await decrypt(msg.content, msg.senderId),
        })),
      );
      setDecryptedMessages(result);
    },
    [decrypt],
  );

  useEffect(() => {
    void decryptAll(messages);
  }, [messages, decryptAll]);

  useEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }, [decryptedMessages]);

  // Закрываем меню при клике вне
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

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
    const plainText = content.trim();
    setContent("");

    const encryptedContent = ready
      ? ((await encrypt(plainText)) ?? plainText)
      : plainText;

    const optimistic: Message = {
      id: crypto.randomUUID(),
      senderId: currentUserId,
      receiverId: recipient.id,
      content: plainText,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setDecryptedMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: recipient.id,
          content: encryptedContent,
        }),
      });
      const saved: Message = await res.json();
      setDecryptedMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...saved, content: plainText } : m,
        ),
      );
    } catch {
      setDecryptedMessages((prev) =>
        prev.filter((m) => m.id !== optimistic.id),
      );
      setContent(plainText);
    } finally {
      setLoading(false);
    }
  };

  // Удалить одно сообщение
  const deleteMessage = async (msgId: string) => {
    await fetch(`/api/chat/messages/${msgId}`, { method: "DELETE" });
    setDecryptedMessages((prev) => prev.filter((m) => m.id !== msgId));
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // Удалить все/свои/чат
  const confirmDelete = async () => {
    if (!deleteMode || !currentUserId) return;
    setDeleting(true);

    if (deleteMode === "chat") {
      // Удаляем все сообщения и закрываем чат
      await fetch("/api/chat/clear", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, mode: "all" }),
      });
      setDeleteMode(null);
      setDeleting(false);
      onChatDeleted?.();
      return;
    }

    await fetch("/api/chat/clear", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: recipient.id, mode: deleteMode }),
    });

    setMessages([]);
    setDecryptedMessages([]);
    setDeleteMode(null);
    setDeleting(false);
  };

  const formatLastSeen = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "был(а) только что";
    if (diffMin < 60) return `был(а) ${diffMin} мин. назад`;
    const isToday = date.toDateString() === now.toDateString();
    if (isToday)
      return `был(а) сегодня в ${date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`;
    return `был(а) ${date.toLocaleDateString(lang, { day: "numeric", month: "long" })} в ${date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`;
  };

  const statusText = isOnline
    ? "в сети"
    : lastSeen[recipient.id]
      ? formatLastSeen(lastSeen[recipient.id])
      : tr.online;

  const deleteModalText: Record<
    NonNullable<DeleteMode>,
    { title: string; desc: string }
  > = {
    mine: {
      title: tr.deleteMyMessages,
      desc: tr.deleteMineDesc,
    },
    all: {
      title: tr.deleteAllMessages,
      desc: tr.deleteAllDesc,
    },
    chat: {
      title: tr.deleteChat,
      desc: tr.deleteChatDesc,
    },
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-(--bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-(--border) bg-(--bg-secondary)">
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold text-(--text-primary) cursor-pointer"
            onClick={() => {
              router.push(`/components/profile/${recipient.id}`);
            }}
          >
            {recipient.name?.[0].toUpperCase() ?? "?"}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-(--bg-secondary) rounded-full" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-semibold text-(--text-primary) cursor-pointer"
              onClick={() => {
                router.push(`/components/profile/${recipient.id}`);
              }}
            >
              {recipient.name}
            </p>
          </div>
          <p
            className={`text-xs transition-colors ${isOnline ? "text-green-500" : "text-(--text-primary)/30"}`}
          >
            {statusText}
          </p>
        </div>

        {/* Меню действий */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((p) => !p)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-colors"
          >
            <EllipsisVertical className="w-4.5 h-4.5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 z-30 bg-(--bg-secondary) border border-(--border) rounded-xl p-1 shadow-xl min-w-48">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
                onClick={() => {
                  router.push(`/profile/${recipient.id}`);
                  setShowMenu(false);
                }}
              >
                <UserCircle className="w-4 h-4" />
                {tr.goToProfile}
              </button>

              <button
                onClick={() => {
                  setDeleteMode("mine");
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteModalText.mine.title}
              </button>
              <button
                onClick={() => {
                  setDeleteMode("all");
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteModalText.all.title}
              </button>
              <div className="h-px bg-(--border) my-1" />
              <button
                onClick={() => {
                  setDeleteMode("chat");
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-left font-medium"
              >
                <XCircle className="w-4 h-4" />
                {deleteModalText.chat.title}
              </button>
            </div>
          )}
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
        {decryptedMessages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg`}
              onMouseEnter={() => setHoveredMsg(msg.id)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className="flex items-end gap-1">
                {/* Кнопка удаления — только для своих */}
                {isMe && hoveredMsg === msg.id && (
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="w-6 h-6 rounded-full bg-(--bg-secondary) flex items-center justify-center text-(--text-primary)/30 hover:text-red-400 transition-colors mb-1 shrink-0"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
                <div
                  className={`max-w-xs px-3 py-2 rounded-2xl text-sm leading-relaxed text-(--text-primary) ${isMe ? "bg-(--bg-card) rounded-br-sm" : "bg-(--bg-secondary) rounded-bl-sm"}`}
                >
                  <p>{msg.content}</p>
                  <p className="text-[10px] mt-1 text-right text-(--text-primary)/30">
                    {new Date(msg.createdAt).toLocaleTimeString(lang, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
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

      {/* Модалка подтверждения */}
      {deleteMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => !deleting && setDeleteMode(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-(--text-primary)">
              {deleteModalText[deleteMode].title}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {deleteModalText[deleteMode].desc}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteMode(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors disabled:opacity-40"
              >
                {tr.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Удаление...
                  </>
                ) : (
                  tr.delete
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
