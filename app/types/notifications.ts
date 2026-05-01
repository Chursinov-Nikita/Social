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

export const typeLabel = (
  type: string,
  tr: {
    notifLike: string;
    notifComment: string;
    notifFriendRequest: string;
    notifFriendAccepted: string;
  },
) => {
  switch (type) {
    case "like":
      return tr.notifLike;
    case "comment":
      return tr.notifComment;
    case "friend_request":
      return tr.notifFriendRequest;
    case "friend_accepted":
      return tr.notifFriendAccepted;
    default:
      return "";
  }
};
