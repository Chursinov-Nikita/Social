"use client";

import { useState } from "react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
};

const CreateFolderModal = ({ isOpen, onClose, onCreate }: Props) => {
  const { lang } = useLang();
  const tr = t[lang];
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreate = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
    setNewFolderName("");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--bg-primary) p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-(--text-primary)">
          {tr.newFolder}
        </p>
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder={tr.folderName}
          autoFocus
          className="w-full rounded-xl border border-(--border) bg-(--bg-primary) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-primary)/25 outline-none focus:border-(--text-primary)/20 transition-colors"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-(--text-primary)/60 hover:bg-(--bg-card) rounded-xl transition-colors"
          >
            {tr.cancel}
          </button>
          <button
            onClick={handleCreate}
            disabled={!newFolderName.trim()}
            className="px-4 py-2 text-xs font-semibold text-(--text-primary) bg-(--bg-card) hover:opacity-80 rounded-xl transition-colors disabled:opacity-30"
          >
            {tr.createFolder}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFolderModal;
