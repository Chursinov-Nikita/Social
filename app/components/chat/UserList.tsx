"use client";

import { useLang } from "@/app/context/language";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import { t } from "@/app/translation/translation";
import type {
  ChatUser,
  Folder,
  GroupChat,
  MessagePreview,
  Props,
} from "@/app/types/chat";
import { decryptPreview } from "@/lib/e2ee";
import { Check, Plus, Search, Users, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import CreateGroupModal from "./CreateGroupModal";

const UserList = ({
  onSelect,
  selected,
}: Props & { onGroupLeft?: () => void }) => {
  const { data: session } = useSession();
  const { lang } = useLang();
  const tr = t[lang];

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [previews, setPreviews] = useState<Record<string, MessagePreview>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderMenuUser, setFolderMenuUser] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [decryptedPreviews, setDecryptedPreviews] = useState<
    Record<string, string>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const userIds = users.map((u) => u.id);
  const { onlineUsers } = useOnlineStatus(userIds);

  const loadPreviews = useCallback(async () => {
    const res = await fetch("/api/chat/previews");
    const data = await res.json();
    setPreviews(data.previews ?? {});
    setUnread(data.unread ?? {});
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (!res.ok) return;
    const data = await res.json();
    setGroups(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !Object.keys(previews).length) return;
    (async () => {
      const result: Record<string, string> = {};
      await Promise.all(
        Object.entries(previews).map(async ([userId, preview]) => {
          result[userId] = await decryptPreview(
            preview.content,
            preview.senderId,
            session?.user?.id || "",
            userId,
          );
        }),
      );
      setDecryptedPreviews(result);
    })();
  }, [previews, session?.user?.id]);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/chat/folders");
    setFolders(await res.json());
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    startTransition(() => {
      fetch("/api/chat/users")
        .then((r) => r.json())
        .then(setUsers);
    });
    void loadPreviews();
    void loadFolders();
    void loadGroups();
    const interval = setInterval(() => {
      void loadPreviews();
      void loadGroups();
    }, 5000);
    return () => clearInterval(interval);
  }, [session?.user?.id, loadPreviews, loadFolders, loadGroups]);

  useEffect(() => {
    if (!folderMenuUser) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setFolderMenuUser(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [folderMenuUser]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch("/api/chat/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    const folder = await res.json();
    setFolders((prev) => [...prev, folder]);
    setNewFolderName("");
    setIsCreateOpen(false);
  };

  const deleteFolder = async (id: string) => {
    setDeletingFolder(id);
    await fetch(`/api/chat/folders/${id}`, { method: "DELETE" });
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (activeFolder === id) setActiveFolder("all");
    setDeletingFolder(null);
  };

  const toggleMember = async (folderId: string, companionId: string) => {
    const res = await fetch(`/api/chat/folders/${folderId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionId }),
    });
    const data = await res.json();
    setFolders((prev) =>
      prev.map((f) => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          members: data.added
            ? [...f.members, { companionId }]
            : f.members.filter((m) => m.companionId !== companionId),
        };
      }),
    );
  };

  const isInFolder = (folderId: string, userId: string) =>
    folders
      .find((f) => f.id === folderId)
      ?.members.some((m) => m.companionId === userId) ?? false;

  const q = searchQuery.trim().toLowerCase();

  const sortedUsers = [...users].sort((a, b) => {
    const aTime = previews[a.id]?.createdAt ?? "";
    const bTime = previews[b.id]?.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });

  const folderFiltered =
    activeFolder === "all"
      ? sortedUsers
      : activeFolder === "unread"
        ? sortedUsers.filter((u) => (unread[u.id] ?? 0) > 0)
        : sortedUsers.filter((u) =>
            folders
              .find((f) => f.id === activeFolder)
              ?.members.some((m) => m.companionId === u.id),
          );

  const filteredUsers = q
    ? folderFiltered.filter((u) => {
        const nameMatch = (u.name ?? "").toLowerCase().includes(q);
        const preview = decryptedPreviews[u.id] ?? "";
        const msgMatch =
          !preview.startsWith("data:audio/") &&
          !preview.startsWith("blob:") &&
          preview.toLowerCase().includes(q);
        return nameMatch || msgMatch;
      })
    : folderFiltered;

  const filteredGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;

  const dmItems = filteredUsers.map((u) => ({
    type: "dm" as const,
    u,
    time: previews[u.id]?.createdAt ?? "",
  }));

  const groupItems = filteredGroups.map((g) => ({
    type: "group" as const,
    g,
    time: g.messages?.[0]?.createdAt ?? g.createdAt,
  }));

  const allItems = [...dmItems, ...groupItems].sort((a, b) =>
    b.time.localeCompare(a.time),
  );

  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString(lang, { day: "numeric", month: "short" });
  };

  const isAudioPreview = (text: string) =>
    text.startsWith("data:audio/") || text.startsWith("blob:");

  const formatPreview = (userId: string) => {
    const preview = previews[userId];
    const decrypted = decryptedPreviews[userId];
    if (!preview) return tr.clickToChat;
    if (!decrypted) return "🔒";
    if (isAudioPreview(decrypted)) return "Голосовое сообщение";
    return decrypted;
  };

  const formatGroupPreview = (g: GroupChat) => {
    const lastMsg = g.messages?.[0];
    if (!lastMsg) return "Нет сообщений";
    if (lastMsg.type === "audio") return "Голосовое сообщение";
    return lastMsg.content?.slice(0, 40) ?? "";
  };

  const highlight = (text: string) => {
    if (!q || text === "Голосовое сообщение" || text === "🔒") return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-400/30 text-inherit rounded-sm">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="group flex flex-col h-full">
      {/* Шапка с поиском */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-(--border)">
        <p className="text-lg font-black">{tr.chats}</p>
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text-primary)/50 pointer-events-none"
            size={15}
            strokeWidth={1.5}
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr.search}
            className="w-full h-9 pl-9 bg-(--bg-secondary) rounded-full text-sm text-(--text-primary) placeholder:text-(--text-secondary) outline-none transition-colors border-2 border-transparent focus:border-(--text-secondary)/20"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--text-primary)/30 hover:text-(--text-primary)/60 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Папки */}
      <div className="p-3 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <button
          onClick={() => setActiveFolder("all")}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFolder === "all" ? "bg-(--bg-card) text-(--text-primary)" : "text-(--text-primary)/40 hover:text-(--text-primary)"}`}
        >
          {tr.allChats}
        </button>
        <button
          onClick={() => setActiveFolder("unread")}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFolder === "unread" ? "bg-(--bg-card) text-(--text-primary)" : "text-(--text-primary)/40 hover:text-(--text-primary)"}`}
        >
          {tr.unread}
          {totalUnread > 0 && (
            <span className="ml-1 min-w-4 h-4 px-1 bg-(--bg-card) text-(--text-primary)/60 text-[10px] font-bold rounded-full">
              {totalUnread}
            </span>
          )}
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="relative shrink-0 group/folder">
            <button
              onClick={() => setActiveFolder(folder.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeFolder === folder.id ? "bg-(--bg-card) text-(--text-primary)" : "text-(--text-primary)/40 hover:text-(--text-primary)"}`}
            >
              {folder.name}
            </button>
            <button
              onClick={() => deleteFolder(folder.id)}
              disabled={deletingFolder === folder.id}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 opacity-0 group-hover/folder:opacity-100 transition-opacity px-2 py-0.5 rounded-md bg-(--bg-secondary) border border-(--border) text-[10px] text-red-400 hover:bg-red-500/10 whitespace-nowrap disabled:opacity-40"
            >
              {deletingFolder === folder.id ? "..." : tr.deleteFolder}
            </button>
          </div>
        ))}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-(--text-primary)/30 hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {allItems.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-(--text-primary)/20 text-xs">
              {q
                ? `${tr.noChatsYet} «${searchQuery}»`
                : activeFolder === "all"
                  ? tr.noChatsYet
                  : tr.noChatsInFolder}
            </p>
          </div>
        ) : (
          allItems.map((item) => {
            // ── Группа ──
            if (item.type === "group") {
              const g = item.g;
              const preview = formatGroupPreview(g);
              const isAudioPreviewGroup = preview === "Голосовое сообщение";
              return (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onSelect({
                      id: g.id,
                      name: g.name,
                      image: g.avatar,
                      isGroup: true,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect({
                        id: g.id,
                        name: g.name,
                        image: g.avatar,
                        isGroup: true,
                      });
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 cursor-pointer select-none ${selected?.id === g.id ? "bg-(--bg-card)" : "hover:bg-(--bg-secondary)"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                    {g.avatar ? (
                      <Image
                        src={g.avatar}
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-10 h-10"
                        alt={g.name}
                      />
                    ) : (
                      <Users className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-(--text-primary) truncate">
                          {highlight(g.name)}
                        </p>
                        <p
                          className={`text-xs truncate mt-0.5 text-(--text-primary)/30 ${isAudioPreviewGroup ? "italic" : ""}`}
                        >
                          {highlight(preview)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-(--text-primary)/30">
                          {formatTime(item.time)}
                        </span>
                        <span className="text-[10px] text-(--text-primary)/20 flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {g.members?.length ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // ── DM ──
            const u = item.u;
            const isOnline = onlineUsers.has(u.id);
            const previewText = formatPreview(u.id);
            const isAudio = previewText === "Голосовое сообщение";
            const isOwn = previews[u.id]?.senderId === session?.user?.id;

            return (
              <div key={u.id} className="relative px-2.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(u)}
                  onContextMenu={(e) => {
                    if (folders.length === 0) return;
                    e.preventDefault();
                    setMenuPosition({ x: e.clientX, y: e.clientY });
                    setFolderMenuUser(folderMenuUser === u.id ? null : u.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(u);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-300 cursor-pointer select-none rounded-full ${selected?.id === u.id ? "bg-(--bg-card)" : "hover:bg-(--bg-secondary)"}`}
                >
                  <div className="relative shrink-0">
                    {u.image ? (
                      <Image
                        src={u.image}
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-10 h-10"
                        alt={u.name ?? ""}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-(--bg-card)">
                        {(u.name ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-(--bg-primary) rounded-full" />
                    )}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-(--text-primary) truncate">
                          {highlight(u.name ?? "")}
                        </p>
                        <p
                          className={`text-xs truncate mt-0.5 ${(unread[u.id] ?? 0) > 0 ? "text-(--text-primary)/60 font-medium" : "text-(--text-primary)/30"} ${isAudio ? "italic" : ""}`}
                        >
                          {isOwn ? (
                            <>Вы: {highlight(previewText)}</>
                          ) : (
                            highlight(previewText)
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {previews[u.id]?.createdAt && (
                          <span className="text-[10px] text-(--text-primary)/30">
                            {formatTime(previews[u.id].createdAt)}
                          </span>
                        )}
                        {(unread[u.id] ?? 0) > 0 && (
                          <span className="min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unread[u.id] > 9 ? "9+" : unread[u.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {folderMenuUser === u.id && (
                  <div
                    ref={menuRef}
                    className="fixed z-50 bg-(--bg-secondary) border border-(--border) rounded-xl p-1 shadow-xl min-w-40"
                    style={{ top: menuPosition.y, left: menuPosition.x }}
                  >
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--text-primary)/30">
                      {tr.folders}
                    </p>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          toggleMember(folder.id, u.id);
                          setFolderMenuUser(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary) hover:bg-(--bg-card) rounded-lg transition-colors"
                      >
                        <span className="flex-1 text-left">{folder.name}</span>
                        {isInFolder(folder.id, u.id) && (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Кнопка создания группы с анимацией ── */}
      <div className="flex items-center justify-end p-5">
        <button
          onClick={() => setIsCreatingGroup(true)}
          className="
        bg-(--bg-secondary) rounded-full p-3.5
        transition-all duration-300 ease-out
        opacity-0 translate-y-3 scale-90 pointer-events-none
        group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:pointer-events-auto
        hover:bg-(--bg-card) hover:scale-110 active:scale-95
      "
        >
          <Plus className="w-5 h-5 text-(--text-primary)/85" />
        </button>
      </div>

      {/* Модалка создания папки */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-(--text-primary)">
              {tr.newFolder}
            </p>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
              placeholder={tr.folderName}
              className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none focus:border-(--text-primary)/20 transition-colors"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-(--text-primary)/60 hover:bg-(--bg-card) rounded-xl transition-colors"
              >
                {tr.cancel}
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 text-xs font-semibold text-(--text-primary) bg-(--bg-card) hover:opacity-80 rounded-xl transition-colors disabled:opacity-30"
              >
                {tr.createFolder}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания группы */}
      {isCreatingGroup && (
        <CreateGroupModal
          onClose={() => setIsCreatingGroup(false)}
          onCreated={(group) => {
            setGroups((prev) => [group, ...prev]);
            setIsCreatingGroup(false);
            onSelect({
              id: group.id,
              name: group.name,
              image: group.avatar,
              isGroup: true,
            });
          }}
        />
      )}
    </div>
  );
};

export default UserList;
