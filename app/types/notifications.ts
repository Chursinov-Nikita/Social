export type NotificationType =
  | "like"
  | "comment"
  | "friend_request"
  | "friend_accepted";

export type Notification = {
  id: string;
  userId: string;
  content: string;
  type: string;
  read: boolean;
  senderId: string | null;
  sender: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
};

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
