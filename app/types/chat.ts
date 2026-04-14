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
}
