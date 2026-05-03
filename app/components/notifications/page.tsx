"use client";

import { useSession } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { useUnreadCounts } from "@/app/hooks/useUnreadCounts";
import { t } from "@/app/translation/translation";
import type { Notification } from "@/app/types/notifications";
import { useCallback, useEffect, useState } from "react";
import Loading from "../loading/Loading";

type NotificationWithFriendship = Notification & {
  friendshipId: string | null;
};

const Notifications = () => {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<
    NotificationWithFriendship[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { lang } = useLang();
  const tr = t[lang];
  const { notifications: unreadCount } = useUnreadCounts();

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    const data: NotificationWithFriendship[] = await res.json();
    setNotifications(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    void load();
  }, [session?.user?.id, load]);

  const markRead = async (id: string) => {
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleFriendRequest = async (
    notification: NotificationWithFriendship,
    action: "accept" | "decline",
  ) => {
    if (!notification.friendshipId || actionLoadingId === notification.id)
      return;
    setActionLoadingId(notification.id);

    try {
      await fetch(`/api/friends/${notification.friendshipId}`, {
        method: action === "accept" ? "PATCH" : "DELETE",
      });

      // Убираем кнопки после действия
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, read: true, friendshipId: null }
            : n,
        ),
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("ru", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-(--bg-primary) text-(--text-primary)">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-(--text-primary) flex items-center gap-2">
              {tr.notificationsTitle}
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-(--text-primary)/40 text-sm mt-0.5">
              {tr.yourActivity}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-(--text-primary)/40 hover:text-(--text-primary) transition-colors"
            >
              {tr.markAllAsRead}
            </button>
          )}
        </div>

        {loading ? (
          <Loading />
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-(--text-primary)/20 text-sm">
            {tr.noNotificationsYet}
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`flex items-start gap-3 p-4 rounded-xl transition-colors cursor-pointer bg-(--bg-secondary) ${!n.read ? "border border-(--border)" : ""}`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${n.read ? "bg-transparent" : "bg-(--text-primary)"}`}
                />

                <div className="w-9 h-9 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                  {n.sender?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={n.sender.image}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                      {n.sender?.name?.[0].toUpperCase() ??
                        n.type[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-(--text-primary)/80">
                    {n.content}
                  </p>
                  <p className="text-xs text-(--text-primary)/30 mt-0.5">
                    {formatDate(n.createdAt)}
                  </p>

                  {n.type === "friend_request" && n.friendshipId && (
                    <div
                      className="mt-3 flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleFriendRequest(n, "accept")}
                        disabled={actionLoadingId === n.id}
                        className="text-xs text-(--text-primary) font-medium px-3 py-1.5 rounded-lg bg-(--bg-card) hover:opacity-80 transition-colors disabled:opacity-50"
                      >
                        {tr.accept}
                      </button>
                      <button
                        onClick={() => handleFriendRequest(n, "decline")}
                        disabled={actionLoadingId === n.id}
                        className="text-xs text-(--text-primary)/40 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {tr.decline}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
