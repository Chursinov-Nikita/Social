export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export interface ChatUser {
  id: string;
  username: string;
  avatar_url: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export type MessagePreview = {
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  read: boolean;
};

export interface UserListProps {
  onSelect: (user: ChatUser) => void;
  selected: ChatUser | null;
}

export interface ChatWindowProps {
  recipient: ChatUser;
}

export type ChatFolderMember = {
  companion_id: string; // id собеседника (UUID)
};

export type Folder = {
  name: string;
  id: string; // UUID папки
  user_id: string; // id владельца
  title: string; // название папки
  position: number; // порядок сортировки
  chat_folder_members: ChatFolderMember[]; // вложенная связь
};

export const tabs = ["All", "Friends", "Work"];
