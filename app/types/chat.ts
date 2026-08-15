export type Message = {
  id: string;
  senderId: string;
  receiverId?: string | null;
  groupId?: string | null;
  content: string;
  read: boolean;
  createdAt: string;
  pinned: boolean;
  pinnedAt?: string | null;
  sender?: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

export type ChatUser = {
  id: string;
  name: string | null;
  image: string | null;
  isGroup?: boolean;
};

export type MessagePreview = {
  content: string;
  createdAt: string;
  senderId: string;
  receiverId: string;
  read: boolean;
};

export type Folder = {
  id: string;
  name: string;
  members: { companionId: string }[];
};

export type GroupChat = {
  id: string;
  name: string;
  avatar: string | null;
  createdBy: string;
  createdAt: string;
  members: GroupMember[];
  messages?: MessageWithType[];
  audioMessages?: Message[];
};

export type GroupMember = {
  userId: string;
  role: "owner" | "member";
  user: ChatUser;
};

export type ChatItem =
  | { type: "dm"; user: ChatUser; preview?: MessagePreview }
  | { type: "group"; group: GroupChat; preview?: MessagePreview };

export type Props = {
  onSelect: (user: ChatUser) => void;
  selected: ChatUser | null;
};

export type DeleteMode = "mine" | "all" | "chat" | null;

export type MessageWithType = Message & { type: "text" | "audio" };

export const PAGE_SIZE = 50;
