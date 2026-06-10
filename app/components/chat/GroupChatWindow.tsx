"use client";

import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import {
  PAGE_SIZE,
  type GroupChat,
  type MessageWithType,
} from "@/app/types/chat";
import {
  EllipsisVertical,
  Loader2,
  MicIcon,
  Smile,
  Square,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { EMOJI_CATEGORIES } from "./emoji";

const GroupChatWindow = ({
  groupId,
  groupName,
  groupAvatar,
}: {
  groupId: string;
  groupName: string;
  groupAvatar: string | null;
}) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];
  const currentUserId = session?.user?.id;

  const [messages, setMessages] = useState<MessageWithType[]>([]);
  const [content, setContent] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [pendingDeleteMsgId, setPendingDeleteMsgId] = useState<string | null>(
    null,
  );
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeCat, setActiveCat] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    fetch(`/api/groups/${groupId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) setGroup(data);
      })
      .catch(console.error);

    fetch(`/api/groups/${groupId}/messages`)
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data: MessageWithType[]) => {
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(console.error);

    fetch(`/api/groups/${groupId}/messages/read`, { method: "PATCH" }).catch(
      console.error,
    );
  }, [groupId, currentUserId]);

  // ── Polling ──
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/messages`);
        if (!res.ok) return;
        const data: MessageWithType[] = await res.json();
        setMessages(data);
      } catch {
        /* игнорируем */
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [groupId, currentUserId]);

  // ── Скролл вниз ──
  useEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Закрытие emoji вне клика ──
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node))
        setShowEmoji(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  // ── Закрытие меню вне клика ──
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // ── Enter во время записи ──
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        stopRecording();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isRecording]);

  const loadOlder = async () => {
    if (!hasMore || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    const cursor = messages[0].id;
    const res = await fetch(`/api/groups/${groupId}/messages?cursor=${cursor}`);
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
      receiverId: null,
      groupId,
      content: plainText,
      type: "text",
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: plainText, type: "text" }),
      });
      const saved: MessageWithType = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? saved : m)),
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setContent(plainText);
    }
  };

  const confirmDeleteMessage = async () => {
    if (!pendingDeleteMsgId) return;
    setDeletingMsg(true);
    await fetch(`/api/chat/messages/${pendingDeleteMsgId}`, {
      method: "DELETE",
    });
    setMessages((prev) => prev.filter((m) => m.id !== pendingDeleteMsgId));
    setPendingDeleteMsgId(null);
    setDeletingMsg(false);
  };

  const formatRecordingTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioMessage(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      let sec = 0;
      recordingTimerRef.current = setInterval(() => {
        sec++;
        setRecordingTime(sec);
        if (sec >= 120) stopRecording();
      }, 1000);
    } catch {
      /* нет доступа к микрофону */
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const sendAudioMessage = async (blob: Blob) => {
    if (!currentUserId) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const tempUrl = URL.createObjectURL(blob);
    const optimistic: MessageWithType = {
      id: crypto.randomUUID(),
      senderId: currentUserId,
      receiverId: null,
      groupId,
      content: tempUrl,
      type: "audio",
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: base64, type: "audio" }),
      });
      const saved: MessageWithType = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id
            ? { ...saved, content: tempUrl, type: "audio" as const }
            : m,
        ),
      );
    } catch {
      URL.revokeObjectURL(tempUrl);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-(--bg-primary)">
      {/* ── Header ── */}
      <div className="bg-(--bg-primary) border-b border-(--border)">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
            {groupAvatar ? (
              <Image
                src={groupAvatar}
                width={36}
                height={36}
                className="rounded-full object-cover"
                alt={groupName}
              />
            ) : (
              <Users className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="flex-1 text-md font-semibold text-(--text-primary) truncate">
              {groupName}
            </p>
            <p className="text-xs text-(--text-primary)/30">
              {group?.members?.length ?? 0} участников
            </p>
          </div>

          <div className="absolute right-4 top-4" ref={menuRef}>
            <button
              onClick={() => setShowMenu((p) => !p)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-colors"
            >
              <EllipsisVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 z-30 bg-(--bg-secondary) border border-(--border) rounded-xl p-1 shadow-xl min-w-48">
                <div>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
                  >
                    Участники
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
                    onClick={async () => {
                      await fetch(`/api/groups/${groupId}/members`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: currentUserId }),
                      });
                      setShowMenu(false);
                      window.location.reload();
                    }}
                  >
                    Выйти из группы
                  </button>

                  {group?.createdBy === currentUserId && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
                      onClick={async () => {
                        await fetch(`/api/groups/${groupId}`, {
                          method: "DELETE",
                        });
                        setShowMenu(false);
                        window.location.reload();
                      }}
                    >
                      Удалить группу
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
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
          const isAudio = msg.type === "audio";
          const senderName = msg.sender?.name ?? "";

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"} group/msg`}
              onMouseEnter={() => setHoveredMsg(msg.id)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className="flex items-end gap-1">
                {isMe && hoveredMsg === msg.id && (
                  <button
                    onClick={() => setPendingDeleteMsgId(msg.id)}
                    className="w-6 h-6 rounded-full bg-(--bg-secondary) flex items-center justify-center text-(--text-primary)/30 hover:text-red-400 transition-colors mb-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className={`${isAudio ? "" : "max-w-xs"}`}>
                  {/* Имя отправителя для чужих сообщений */}
                  {!isMe && (
                    <p className="text-[10px] text-(--text-primary)/40 mb-0.5 px-1">
                      {senderName}
                    </p>
                  )}
                  <div
                    className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed text-(--text-primary) ${isMe ? "bg-(--bg-card) rounded-br-sm" : "bg-(--bg-secondary) rounded-bl-sm"}`}
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
            </div>
          );
        })}
      </div>

      {/* ── Input ── */}
      <div className="py-5 px-3">
        {isRecording ? (
          <div className="flex items-center gap-3 bg-(--bg-secondary) rounded-full px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-(--text-primary) flex-1 tabular-nums">
              {formatRecordingTime(recordingTime)}
            </span>
            <button
              onClick={cancelRecording}
              className="text-(--text-primary)/40 hover:text-red-400 transition-colors p-1"
            >
              <XCircle className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 rounded-full p-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-white text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1">
            <div ref={emojiRef} className="relative">
              <button
                onClick={() => setShowEmoji((p) => !p)}
                className="bg-(--bg-secondary) rounded-full p-2.5 transition-colors hover:bg-(--bg-card)"
              >
                <Smile className="w-6 h-6 text-(--text-primary)/85" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-14 left-0 z-30 bg-(--bg-secondary) border border-(--border) rounded-2xl shadow-2xl w-72 overflow-hidden">
                  <div className="flex border-b border-(--border)">
                    {EMOJI_CATEGORIES.map((cat, i) => (
                      <button
                        key={cat.label}
                        onClick={() => setActiveCat(i)}
                        className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                          activeCat === i
                            ? "text-(--text-primary) border-b-2 border-(--text-primary) -mb-px"
                            : "text-(--text-primary)/40 hover:text-(--text-primary)/70"
                        }`}
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
                  if (isRecording) stopRecording();
                  else void sendMessage();
                }
              }}
              placeholder={tr.writeMessage}
              rows={1}
              className="flex-1 bg-(--bg-secondary) rounded-full px-4.5 py-2.5 text-md text-(--text-primary) placeholder:text-(--text-primary)/90 resize-none focus:outline-none transition-colors"
            />

            <button
              onClick={startRecording}
              className="bg-(--bg-secondary) rounded-full p-2.5 transition-colors hover:bg-(--bg-card)"
            >
              <MicIcon className="w-6 h-6 text-(--text-primary)/85" />
            </button>
          </div>
        )}
      </div>

      {/* ── Модалка удаления сообщения ── */}
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
    </div>
  );
};

export default GroupChatWindow;
