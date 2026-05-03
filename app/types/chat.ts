export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
};

export type ChatUser = {
  id: string;
  name: string | null;
  image: string | null;
};

export type MessagePreview = {
  content: string;
  createdAt: string;
  senderId: string;
  receiverId: string;
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
