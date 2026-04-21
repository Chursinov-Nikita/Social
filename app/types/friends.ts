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

export type Tab = "friends" | "requests" | "search";

export type SearchUser = {
  id: string;
  username: string;
  relationStatus: "none" | "pending" | "accepted";
};

export type FriendToRemove = { id: string; username?: string };
