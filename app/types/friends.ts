export type Friendship = {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  sender: FriendUser;
};

export type FriendUser = {
  id: string;
  name: string | null;
  image: string | null;
};

export type SearchUser = {
  id: string;
  name: string | null;
  image: string | null;
  relationStatus: "none" | "pending" | "accepted";
};

export type FriendToRemove = {
  id: string;
  name: string | null;
};

export type Tab = "friends" | "requests" | "search";

export type FriendShipStatus = "pending" | "accepted" | "rejected";
