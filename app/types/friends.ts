export type FriendShipStatus = "pending" | "accepted" | "rejected";

export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendShipStatus;
  created_at: string;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}
