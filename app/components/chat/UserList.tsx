"use client";

import { useAuth } from "@/app/context/auth";
import { useLang } from "@/app/context/language";
import { createClient } from "@/app/lib/supabase/client";
import { t } from "@/app/translation/translation";
import {
  ChatUser,
  Folder,
  MessagePreview,
  UserListProps,
} from "@/app/types/chat";
import { useEffect, useMemo, useState } from "react";

const UserList = ({ onSelect, selected }: UserListProps) => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [previews, setPreviews] = useState<Record<string, MessagePreview>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { lang } = useLang();
  const tr = t[lang];

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .neq("id", user.id)
      .then(({ data }: { data: ChatUser[] | null }) => {
        if (data) {
          setUsers(
            data.filter(
              (u, i, self) => i === self.findIndex((t) => t.id === u.id),
            ),
          );
        }
      });
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;

    const loadPreviews = async () => {
      const { data } = await supabase
        .from("messages")
        .select("content, created_at, sender_id, receiver_id, read")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!data) return;

      const lastMessages: Record<string, MessagePreview> = {};
      const unreadCounts: Record<string, number> = {};

      data.forEach((msg: MessagePreview) => {
        const companionId =
          msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!lastMessages[companionId]) lastMessages[companionId] = msg;
        if (msg.receiver_id === user.id && !msg.read) {
          unreadCounts[companionId] = (unreadCounts[companionId] ?? 0) + 1;
        }
      });

      setPreviews(lastMessages);
      setUnread(unreadCounts);
    };

    void loadPreviews();

    const channel = supabase
      .channel("userlist-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void loadPreviews(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => void loadPreviews(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;

    const loadFolders = async () => {
      const { data } = await supabase
        .from("chat_folders")
        .select("*, chat_folder_members(companion_id)")
        .eq("user_id", user.id)
        .order("position");
      if (data) setFolders(data as Folder[]);
    };

    void loadFolders();
  }, [user, supabase]);

  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    await supabase.from("chat_folders").insert({
      user_id: user.id,
      name: newFolderName.trim(),
      position: folders.length,
    });
    const { data } = await supabase
      .from("chat_folders")
      .select("*, chat_folder_members(companion_id)")
      .eq("user_id", user.id)
      .order("position");
    if (data) setFolders(data as Folder[]);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  const addToFolder = async (folderId: string, companionId: string) => {
    await supabase
      .from("chat_folder_members")
      .upsert(
        { folder_id: folderId, companion_id: companionId },
        { onConflict: "folder_id,companion_id", ignoreDuplicates: true },
      );
    const { data } = await supabase
      .from("chat_folders")
      .select("*, chat_folder_members(companion_id)")
      .eq("user_id", user?.id)
      .order("position");
    if (data) setFolders(data as Folder[]);
    setIsFolderMenuOpen(null);
  };

  const removeFromFolder = async (folderId: string, companionId: string) => {
    await supabase
      .from("chat_folder_members")
      .delete()
      .eq("folder_id", folderId)
      .eq("companion_id", companionId);
    const { data } = await supabase
      .from("chat_folders")
      .select("*, chat_folder_members(companion_id)")
      .eq("user_id", user?.id)
      .order("position");
    if (data) setFolders(data as Folder[]);
  };

  const deleteFolder = async (folderId: string) => {
    await supabase.from("chat_folders").delete().eq("id", folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolder === folderId) setActiveFolder("all");
  };

  const filteredUsers =
    activeFolder === "all"
      ? users
      : users.filter((u) =>
          folders
            .find((f) => f.id === activeFolder)
            ?.chat_folder_members.some((m) => m.companion_id === u.id),
        );

  const isInFolder = (folderId: string, companionId: string) =>
    folders
      .find((f) => f.id === folderId)
      ?.chat_folder_members.some((m) => m.companion_id === companionId) ??
    false;

  return (
    <div className="flex flex-col h-full">
      {/* Заголовок */}
      <div className="p-4 border-b border-(--border)">
        <p className="text-sm font-semibold text-(--text-primary)">
          {tr.messages}
        </p>
      </div>

      {/* Папки */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setActiveFolder("all")}
          className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            activeFolder === "all"
              ? "bg-(--bg-card) text-(--text-primary)"
              : "text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-secondary)"
          }`}
        >
          All
        </button>

        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => setActiveFolder(folder.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsFolderMenuOpen(`folder-${folder.id}`);
            }}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              activeFolder === folder.id
                ? "bg-(--bg-card) text-(--text-primary)"
                : "text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-secondary)"
            }`}
          >
            <span>{folder.name}</span>
          </button>
        ))}

        {/* Контекстное меню папки */}
        {folders.map((folder) =>
          isFolderMenuOpen === `folder-${folder.id}` ? (
            <div
              key={`menu-${folder.id}`}
              className="fixed inset-0 z-50 flex justify-center items-center"
              onClick={() => setIsFolderMenuOpen(null)}
            >
              <div
                className="absolute bg-(--bg-secondary) border border-(--border) rounded-xl p-1 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => deleteFolder(folder.id)}
                  className="w-full px-4 py-2 text-xs text-red-400 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
                >
                  Delete folder
                </button>
              </div>
            </div>
          ) : null,
        )}

        <button
          onClick={() => setIsCreateFolderOpen(true)}
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

      {/* Список пользователей */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-(--text-primary)/20 text-xs">
            {activeFolder === "all"
              ? "No chats yet"
              : "No chats in this folder"}
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.id} className="relative group">
              <button
                onClick={() => onSelect(u)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-150
                  ${selected?.id === u.id ? "bg-(--bg-card)" : "hover:bg-(--bg-secondary)"}`}
              >
                <div className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {u.username}
                    </p>
                    {(unread[u.id] ?? 0) > 0 && (
                      <span className="w-4 h-4 bg-(--bg-card) text-(--text-primary)/80 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {unread[u.id] > 9 ? "9+" : unread[u.id]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-(--text-primary)/30 truncate">
                    {previews[u.id]?.content ?? tr.clickToChat}
                  </p>
                </div>
              </button>

              {/* Кнопка добавления в папку */}
              {folders.length > 0 && (
                <button
                  onClick={() =>
                    setIsFolderMenuOpen(isFolderMenuOpen === u.id ? null : u.id)
                  }
                  className="absolute right-3 top-12 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-(--text-primary)/30 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all"
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
                      d="M3 7a2 2 0 012-2h3.172a2 2 0 011.414.586l1.828 1.828A2 2 0 0012.828 8H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                    />
                  </svg>
                </button>
              )}

              {/* Меню папок для пользователя */}
              {isFolderMenuOpen === u.id && (
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setIsFolderMenuOpen(null)}
                >
                  <div
                    className="absolute bg-(--bg-secondary) border border-(--border) rounded-xl p-1 shadow-xl min-w-40"
                    style={{
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--text-primary)/30">
                      Folders
                    </p>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() =>
                          isInFolder(folder.id, u.id)
                            ? removeFromFolder(folder.id, u.id)
                            : addToFolder(folder.id, u.id)
                        }
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
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Модалка создания папки */}
      {isCreateFolderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setIsCreateFolderOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-(--text-primary)">
              New folder
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
                className="flex-1 rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none focus:border-(--text-primary)/20 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateFolderOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-(--text-primary)/60 hover:text-(--text-primary) hover:bg-(--bg-card) rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 text-xs font-semibold text-(--text-primary) bg-(--bg-card) hover:opacity-80 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
