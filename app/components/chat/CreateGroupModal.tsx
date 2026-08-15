"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { ChatUser, GroupChat } from "@/app/types/chat";
import Image from "next/image";
import { t } from "@/app/translation/translation";
import { useLang } from "@/app/context/language";

type Props = {
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => Promise<GroupChat>;
};

const CreateGroupModal = ({ onClose, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { lang } = useLang();
  const tr = t[lang];

  useEffect(() => {
    fetch("/api/chat/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);

  const filtered = users.filter((u) =>
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.length === 0) return;
    setLoading(true);
    try {
      await onCreate(name.trim(), selected);
    } catch (error) {
      console.error("Failed to create group", error);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--bg-primary) p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-(--text-primary)">
          {tr.newGroup}
        </p>

        {/* Название */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr.groupName}
          className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none focus:border-(--text-primary)/20 transition-colors"
        />

        {/* Теги выбранных */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((id) => {
              const user = users.find((u) => u.id === id);
              if (!user) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-(--bg-card) text-xs text-(--text-primary)"
                >
                  {user.name}
                  <button onClick={() => toggle(id)}>
                    <X className="w-3 h-3 text-(--text-primary)/40 hover:text-red-400" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Поиск */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr.searchMembers}
          className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none focus:border-(--text-primary)/20 transition-colors"
        />

        {/* Список пользователей */}
        <div className="max-h-48 overflow-y-auto space-y-0.5 [scrollbar-width:thin]">
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => toggle(user.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                selected.includes(user.id)
                  ? "bg-(--bg-card)"
                  : "hover:bg-(--bg-card)/50"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-(--bg-card) flex items-center justify-center text-xs font-bold text-(--text-primary) shrink-0 overflow-hidden">
                {user.image ? (
                  <Image
                    src={user.image}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                    alt={user.name ?? ""}
                  />
                ) : (
                  (user.name ?? "?")[0].toUpperCase()
                )}
              </div>
              <span className="flex-1 text-left text-sm text-(--text-primary)">
                {user.name}
              </span>
              {selected.includes(user.id) && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </button>
          ))}
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-(--text-primary)/60 hover:bg-(--bg-card) rounded-xl transition-colors disabled:opacity-40"
          >
            {tr.cancel}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selected.length === 0 || loading}
            className="px-4 py-2 text-xs font-semibold text-(--text-primary) bg-(--bg-card) hover:opacity-80 rounded-xl transition-colors disabled:opacity-30"
          >
            {loading ? tr.creating : tr.createFolder}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
