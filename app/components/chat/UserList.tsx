"use client";

import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";
import type { ChatUser, MessagePreview, Folder, Props } from "@/app/types/chat";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import { decryptPreview } from "@/lib/e2ee";

const UserList = ({ onSelect, selected }: Props) => {
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [decryptedPreviews, setDecryptedPreviews] = useState<
    Record<string, string>
  >({});

  const userIds = users.map((u) => u.id);
  const { onlineUsers } = useOnlineStatus(userIds);

  const loadPreviews = useCallback(async () => {
    const res = await fetch("/api/chat/previews");
    const data = await res.json();
    setPreviews(data.previews ?? {});
    setUnread(data.unread ?? {});
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !Object.keys(previews).length) return;

    const decryptAll = async () => {
      const result: Record<string, string> = {};
      await Promise.all(
        Object.entries(previews).map(async ([userId, preview]) => {
          result[userId] = await decryptPreview(
            preview.content,
            preview.senderId,
            session?.user?.id || "",
          );
        }),
      );
      setDecryptedPreviews(result);
    };

    void decryptAll();
  }, [previews, session?.user?.id]);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/chat/folders");
    setFolders(await res.json());
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/chat/users")
      .then((r) => r.json())
      .then(setUsers);
    void loadPreviews();
    void loadFolders();
    const interval = setInterval(loadPreviews, 5000);
    return () => clearInterval(interval);
  }, [session?.user?.id, loadPreviews, loadFolders]);

  useEffect(() => {
    if (!folderMenuUser) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFolderMenuUser(null);
      }
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

  const sortedUsers = [...users].sort((a, b) => {
    const aTime = previews[a.id]?.createdAt ?? "";
    const bTime = previews[b.id]?.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });

  const filteredUsers =
    activeFolder === "all"
      ? sortedUsers
      : sortedUsers.filter((u) =>
          folders
            .find((f) => f.id === activeFolder)
            ?.members.some((m) => m.companionId === u.id),
        );

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString(lang, { day: "numeric", month: "short" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-(--border)">
        <p className="text-sm font-semibold text-(--text-primary)">
          {tr.messages}
        </p>
      </div>

      {/* Папки */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <button
          onClick={() => setActiveFolder("all")}
          className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeFolder === "all" ? "bg-(--bg-card) text-(--text-primary)" : "text-(--text-primary)/40 hover:text-(--text-primary)"}`}
        >
          {tr.allChats}
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
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-(--text-primary)/30 hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-(--text-primary)/20 text-xs">
            {activeFolder === "all" ? tr.noChatsYet : tr.noChatsInFolder}
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isOnline = onlineUsers.has(u.id);
            return (
              <div key={u.id} className="relative">
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
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150 cursor-pointer select-none ${selected?.id === u.id ? "bg-(--bg-card)" : "hover:bg-(--bg-secondary)"}`}
                >
                  {/* Аватар */}
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
                      <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold text-(--text-primary)">
                        {(u.name ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-(--bg-primary) rounded-full" />
                    )}
                  </div>

                  {/* Текст */}
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-(--text-primary) truncate">
                          {u.name}
                        </p>
                        <p
                          className={`text-xs truncate mt-0.5 ${(unread[u.id] ?? 0) > 0 ? "text-(--text-primary)/60 font-medium" : "text-(--text-primary)/30"}`}
                        >
                          {previews[u.id]
                            ? previews[u.id].senderId === session?.user?.id
                              ? `Вы: ${decryptedPreviews[u.id] ?? "🔒"}`
                              : (decryptedPreviews[u.id] ?? "🔒")
                            : tr.clickToChat}
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

                {/* Контекстное меню папок */}
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
                          <svg
                            className="w-3.5 h-3.5 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
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
    </div>
  );
};

export default UserList;
