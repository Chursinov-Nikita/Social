export type NotificationType =
  | "like"
  | "comment"
  | "friend_request"
  | "friend_accepted";

export interface Notification {
  id: string;
  user_id: string;
  sender_id: string;
  type: NotificationType;
  post_id: string | null;
  read: boolean;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string | null;
  };
}

export const typeLabel = (type: string) => {
  switch (type) {
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "friend_request":
      return "sent you a friend request";
    case "friend_accepted":
      return "accepted your friend request";
    default:
      return "";
  }
};
