"use client";

import { useLang } from "@/app/context/language";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import { t } from "@/app/translation/translation";
import type { ChatUser } from "@/app/types/chat";
import { DeleteMode, MessageWithType, PAGE_SIZE } from "@/app/types/chat";
import {
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  Loader2,
  LucideSendHorizonal,
  PinIcon,
  Search,
  Smile,
  Trash2,
  UserCircle,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EMOJI_CATEGORIES } from "./emoji";

const useClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
) => {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [enabled, ref, onClose]);
};

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
  const router = useRouter();

  const [messages, setMessages] = useState<MessageWithType[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<MessageWithType[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [content, setContent] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInputMenu, setShowInputMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [pendingDeleteMsgId, setPendingDeleteMsgId] = useState<string | null>(
    null,
  );
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [activeCat, setActiveCat] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const { onlineUsers, lastSeen } = useOnlineStatus([recipient.id]);
  const isOnline = onlineUsers.has(recipient.id);

  useClickOutside(menuRef, () => setShowMenu(false), showMenu);
  useClickOutside(inputMenuRef, () => setShowInputMenu(false), showInputMenu);
  useClickOutside(emojiRef, () => setShowEmoji(false), showEmoji);

  useEffect(() => {
    if (!currentUserId) return;
    startTransition(() => {
      setMessages([]);
      setDecryptedMessages([]);
      setHasMore(true);
    });
    fetch(`/api/chat/messages?recipientId=${recipient.id}`)
      .then((r) => r.json())
      .then((data: MessageWithType[]) => {
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
      const data: MessageWithType[] = await res.json();
      setMessages(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [recipient.id, currentUserId]);

  const syncMessages = useCallback((msgs: MessageWithType[]) => {
    setDecryptedMessages(msgs);
  }, []);

  useEffect(() => {
    syncMessages(messages);
  }, [messages, syncMessages]);

  useEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }, [decryptedMessages]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const ids = decryptedMessages
      .filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .map((m) => m.id);
    setSearchResults(ids);
    setCurrentSearchIndex(0);
  }, [searchQuery, decryptedMessages]);

  useEffect(() => {
    if (!searchResults.length) return;
    const id = searchResults[currentSearchIndex];
    document
      .getElementById(`msg-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSearchIndex, searchResults]);

  useEffect(() => {
    if (!showInputMenu) {
      setSearchQuery("");
      setSearchResults([]);
      setCurrentSearchIndex(0);
    }
  }, [showInputMenu]);

  const goToPrevResult = () =>
    setCurrentSearchIndex(
      (i) => (i - 1 + searchResults.length) % searchResults.length,
    );

  const goToNextResult = () =>
    setCurrentSearchIndex((i) => (i + 1) % searchResults.length);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-gray-500/40 text-inherit rounded-sm">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const loadOlder = async () => {
    if (!messages.length || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const cursor = messages[0].createdAt;
    const res = await fetch(
      `/api/chat/messages?recipientId=${recipient.id}&cursor=${cursor}`,
    );
    const older: MessageWithType[] = await res.json();
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length === PAGE_SIZE);
    setLoadingOlder(false);
  };

  const sendMessage = async () => {
    if (!content.trim() || !currentUserId) return;
    const plainText = content.trim();
    setContent("");
    const optimistic: MessageWithType = {
      id: crypto.randomUUID(),
      senderId: currentUserId,
      receiverId: recipient.id,
      content: plainText,
      type: "text",
      read: false,
      createdAt: new Date().toISOString(),
      pinned: false,
    };
    setDecryptedMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: recipient.id,
          content: plainText,
        }),
      });
      const saved: MessageWithType = await res.json();
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
    }
  };

  useEffect(() => {
    if (showInputMenu) {
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [showInputMenu]);

  const confirmDeleteMessage = async () => {
    if (!pendingDeleteMsgId) return;
    setDeletingMsg(true);
    await fetch(`/api/chat/messages/${pendingDeleteMsgId}`, {
      method: "DELETE",
    });
    setDecryptedMessages((prev) =>
      prev.filter((m) => m.id !== pendingDeleteMsgId),
    );
    setMessages((prev) => prev.filter((m) => m.id !== pendingDeleteMsgId));
    setPendingDeleteMsgId(null);
    setDeletingMsg(false);
  };

  const confirmDelete = async () => {
    if (!deleteMode || !currentUserId) return;
    setDeleting(true);
    if (deleteMode === "chat") {
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
    if (diffMin < 1) return tr.wasOnlineNow;
    if (diffMin < 60) return tr.wasOnlineMins(diffMin);
    const timeStr = date.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    if (dateOnly.getTime() === today.getTime())
      return tr.wasOnlineToday(timeStr);
    if (dateOnly.getTime() === yesterday.getTime())
      return tr.wasOnlineYesterday(timeStr);
    return tr.wasOnlineDate(
      date.toLocaleDateString(lang, { day: "numeric", month: "long" }),
      timeStr,
    );
  };

  const statusText = isOnline
    ? "в сети"
    : lastSeen[recipient.id]
      ? formatLastSeen(lastSeen[recipient.id])
      : tr.online;

  const deleteModalTitles: Record<NonNullable<DeleteMode>, string> = {
    mine: tr.deleteMyMessages,
    all: tr.deleteAllMessages,
    chat: tr.deleteChat,
  };

  const deleteModalDescs: Record<NonNullable<DeleteMode>, string> = {
    mine: tr.deleteMineDesc,
    all: tr.deleteAllDesc,
    chat: tr.deleteChatDesc,
  };

  const pinned = decryptedMessages.filter((m) => m.pinned);

  const scrollToPinned = (id: string) => {
    document
      .getElementById(`msg-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMsgId(id);
    setTimeout(() => setHighlightedMsgId(null), 1500);
  };

  const handlePinnedPanelClick = () => {
    if (!pinned.length) return;
    const target = pinned[pinnedIndex];
    scrollToPinned(target.id);
    setPinnedIndex((i) => (i + 1) % pinned.length);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-(--bg-primary)">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-(--border) bg-(--bg-primary)">
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold text-(--text-primary) cursor-pointer overflow-hidden"
            onClick={() => router.push(`/components/profile/${recipient.id}`)}
          >
            {recipient.image ? (
              <Image
                src={recipient.image}
                width={36}
                height={36}
                className="rounded-full object-cover w-9 h-9"
                alt={recipient.name ?? ""}
              />
            ) : (
              (recipient.name ?? "?")[0].toUpperCase()
            )}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-(--bg-secondary) rounded-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold text-(--text-primary) cursor-pointer truncate"
            onClick={() => router.push(`/components/profile/${recipient.id}`)}
          >
            {recipient.name}
          </p>
          <p
            className={`text-xs transition-colors ${isOnline ? "text-green-500" : "text-(--text-primary)/30"}`}
          >
            {statusText}
          </p>
        </div>

        <div className="relative flex items-center gap-2" ref={menuRef}>
          <div ref={inputMenuRef} className="relative flex items-center">
            <button
              onClick={() => setShowInputMenu(true)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all duration-300
                ${showInputMenu ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"}`}
            >
              <Search className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <div
              className={`absolute right-0 flex items-center gap-1 transition-all duration-300
              ${showInputMenu ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr.search}
                className={`bg-(--bg-secondary) rounded-full py-1.5 px-4 text-sm text-(--text-primary) placeholder:text-(--text-secondary) outline-none border-2 border-transparent focus:border-(--text-secondary)/10 transition-all duration-300
                  ${showInputMenu ? "w-80" : "w-0"}`}
              />

              {searchResults.length > 0 && (
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  <span className="text-xs text-(--text-primary)/40 tabular-nums whitespace-nowrap">
                    {currentSearchIndex + 1}/{searchResults.length}
                  </span>
                  <button
                    onClick={goToPrevResult}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-(--bg-card) text-(--text-primary)/50 hover:text-(--text-primary) transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={goToNextResult}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-(--bg-card) text-(--text-primary)/50 hover:text-(--text-primary) transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {searchQuery.trim() && searchResults.length === 0 && (
                <span className="text-xs text-(--text-primary)/30 whitespace-nowrap px-3">
                  не найдено
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowMenu((p) => !p)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-colors"
          >
            <EllipsisVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-15 z-30 bg-(--bg-primary) border border-(--border) rounded-xl p-1 shadow-sm min-w-48">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
                onClick={() => {
                  router.push(`/components/profile/${recipient.id}`);
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
                {deleteModalTitles.mine}
              </button>
              <button
                onClick={() => {
                  setDeleteMode("all");
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteModalTitles.all}
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
                {deleteModalTitles.chat}
              </button>
            </div>
          )}
        </div>
      </div>

      {pinned.length > 0 && (
        <div
          className="flex items-center gap-3 px-6 py-2.5 bg-(--bg-secondary) cursor-pointer hover:bg-(--bg-card) transition-colors rounded-full box-border m-3"
          onClick={handlePinnedPanelClick}
        >
          <PinIcon className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-(--text-primary) font-medium">
              {tr.pinned}
            </p>
            <p className="text-xs text-(--text-primary)/40 truncate">
              {pinned[pinnedIndex % pinned.length].content}
            </p>
          </div>
          {pinned.length > 1 && (
            <span className="text-[10px] text-(--text-primary)/30 shrink-0">
              {(pinnedIndex % pinned.length) + 1}/{pinned.length}
            </span>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-16 py-4 space-y-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
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
          const isCurrent = searchResults[currentSearchIndex] === msg.id;
          const isMatch = searchResults.includes(msg.id);
          const isHighlighted = highlightedMsgId === msg.id;

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg`}
              onMouseEnter={() => setHoveredMsg(msg.id)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className="flex items-end gap-1">
                {hoveredMsg === msg.id && (
                  <div
                    className={`flex flex-row gap-1.5 ${isMe ? "" : "order-last"}`}
                  >
                    {isMe && (
                      <button
                        onClick={() => setPendingDeleteMsgId(msg.id)}
                        className="w-5 h-5 p-1 rounded-full bg-(--bg-secondary) flex items-center justify-center text-(--text-primary)/50 hover:text-red-400 hover:bg-(--bg-card)/70 transition-colors mb-2 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await fetch(`/api/chat/messages/${msg.id}/pin`, {
                          method: "PATCH",
                        });
                        setDecryptedMessages((prev) =>
                          prev.map((m) =>
                            m.id === msg.id ? { ...m, pinned: !m.pinned } : m,
                          ),
                        );
                      }}
                      className="w-5 h-5 p-1 rounded-full bg-(--bg-secondary) flex items-center justify-center hover:bg-(--bg-card)/70 transition-colors mb-2 shrink-0"
                    >
                      <PinIcon
                        className={`w-3.5 h-3.5 transition-colors ${msg.pinned ? "text-blue-500" : "text-(--text-primary)/50 hover:text-(--text-primary)"}`}
                      />
                    </button>
                  </div>
                )}
                <div
                  className={`flex justify-between py-1.5 px-6 rounded-full text-sm leading-relaxed text-(--text-primary) transition-all duration-300 max-w-xs
                    ${isMe ? "bg-(--bg-card) rounded-br-none" : "bg-(--bg-secondary) rounded-bl-none"}
                    ${isCurrent ? "ring-2 ring-gray-500/60" : ""}
                    ${isHighlighted ? "ring-2 ring-blue-500/60 scale-[1.02] brightness-110" : ""}
                  `}
                >
                  <p>
                    {isMatch
                      ? highlightText(msg.content, searchQuery)
                      : msg.content}
                  </p>
                  <div className="flex items-end ml-3">
                    <p className="text-[9px] text-(--text-primary)/40">
                      {new Date(msg.createdAt).toLocaleTimeString(lang, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="py-5 px-15">
        <div className="flex items-end gap-1">
          <div ref={emojiRef} className="relative">
            <button
              onClick={() => setShowEmoji((p) => !p)}
              className="bg-(--bg-secondary) rounded-full p-3.5 transition-colors hover:bg-(--bg-card)"
            >
              <Smile className="w-5 h-5 text-(--text-primary)/85" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-14 left-0 z-30 bg-(--bg-secondary) border border-(--border) rounded-2xl shadow-2xl w-72 overflow-hidden">
                <div className="flex border-b border-(--border)">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button
                      key={cat.label}
                      onClick={() => setActiveCat(i)}
                      className={`flex-1 py-2 text-[11px] font-medium transition-colors ${activeCat === i ? "text-(--text-primary) border-b-2 border-(--text-primary) -mb-px" : "text-(--text-primary)/40 hover:text-(--text-primary)/70"}`}
                    >
                      {cat.emojis[0]}
                    </button>
                  ))}
                </div>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-(--text-primary)/30">
                  {EMOJI_CATEGORIES[activeCat].label}
                </p>
                <div className="grid grid-cols-8 gap-px px-2 pb-2">
                  {EMOJI_CATEGORIES[activeCat].emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setContent((prev) => prev + emoji);
                        setShowEmoji(false);
                      }}
                      className="aspect-square flex items-center justify-center text-2xl hover:bg-(--bg-card) rounded-xl transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={tr.writeMessage}
            rows={1}
            className="flex-1 bg-(--bg-secondary) rounded-full py-3.5 px-5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/85 resize-none focus:outline-none transition-colors overflow-hidden"
          />

          <button
            onClick={() => void sendMessage()}
            className="w-12 h-12 bg-(--bg-secondary) rounded-full flex items-center justify-center transition-colors hover:bg-(--bg-card)"
          >
            <LucideSendHorizonal className="w-5 h-5 text-(--text-primary)/85 pl-0.5" />
          </button>
        </div>
      </div>

      {pendingDeleteMsgId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => !deletingMsg && setPendingDeleteMsgId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-(--text-primary)">
              {tr.deleteThisMessage}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {tr.deleteThisMessageDesc}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDeleteMsgId(null)}
                disabled={deletingMsg}
                className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors disabled:opacity-40"
              >
                {tr.cancel}
              </button>
              <button
                onClick={confirmDeleteMessage}
                disabled={deletingMsg}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingMsg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {tr.deleting}
                  </>
                ) : (
                  tr.delete
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              {deleteModalTitles[deleteMode]}
            </h2>
            <p className="mt-2 text-sm text-(--text-primary)/60">
              {deleteModalDescs[deleteMode]}
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
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {tr.deleting}
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
