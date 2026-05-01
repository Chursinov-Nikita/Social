"use client";
import { useAuth } from "@/app/context/auth";
import { useLang } from "@/app/context/language";
import useUnreadNotifications from "@/app/hooks/useUnreadNotification";
import { createClient } from "@/app/lib/supabase/client";
import { t } from "@/app/translation/translation";
import type { Notification } from "@/app/types/notifications";
import { typeLabel } from "@/app/types/notifications";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const Notifications = () => {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionableRequestIds, setActionableRequestIds] = useState<Set<string>>(
    new Set(),
  );
  const { lang } = useLang();
  const tr = t[lang];

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const { data } = (await supabase
      .from("notifications")
      .select("*, sender:sender_id (username, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)) as { data: Notification[] | null };

    if (!data) return setLoading(false);

    setNotifications(data);

    const requestSenderIds = [
      ...new Set(
        data.filter((n) => n.type === "friend_request").map((n) => n.sender_id),
      ),
    ];

    if (requestSenderIds.length > 0) {
      const { data: pendingRequests } = await supabase
        .from("friendships")
        .select("sender_id")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .in("sender_id", requestSenderIds);

      const pendingSenders = new Set(
        (pendingRequests ?? []).map(
          (item: { sender_id: string }) => item.sender_id,
        ),
      );

      setActionableRequestIds(
        new Set(
          data
            .filter(
              (n) =>
                n.type === "friend_request" && pendingSenders.has(n.sender_id),
            )
            .map((n) => n.id),
        ),
      );
    } else {
      setActionableRequestIds(new Set());
    }

    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;

    void loadNotifications();

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          if ((payload.new as Notification).user_id === user.id) {
            void loadNotifications();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications, supabase]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const handleRequestAction = async (
    notification: Notification,
    action: "accept" | "decline",
  ) => {
    if (!user || actionLoadingId === notification.id) return;
    setActionLoadingId(notification.id);

    try {
      if (action === "accept") {
        await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("sender_id", notification.sender_id)
          .eq("receiver_id", user.id)
          .eq("status", "pending");
      } else {
        await supabase
          .from("friendships")
          .delete()
          .eq("sender_id", notification.sender_id)
          .eq("receiver_id", user.id)
          .eq("status", "pending");
      }

      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notification.id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      setActionableRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const unreadCount = useUnreadNotifications();

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "Z").toLocaleString("ru", {
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
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-(--text-primary)/20 border-t-(--text-primary)/60 rounded-full animate-spin" />
          </div>
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
                className={`flex items-center gap-3 p-4 rounded-xl transition-colors cursor-pointer bg-(--bg-secondary)
                  ${!n.read ? "border border-(--border)" : ""}`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-(--text-primary)"}`}
                />

                <div className="w-9 h-9 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold shrink-0 text-(--text-primary)">
                  {n.sender?.username?.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-(--text-primary) truncate">
                    <span className="font-medium">{n.sender?.username}</span>{" "}
                    <span className="text-(--text-primary)/50">
                      {typeLabel(n.type, tr)}
                    </span>
                  </p>
                  <p className="text-xs text-(--text-primary)/30 mt-0.5">
                    {formatDate(n.created_at)}
                  </p>

                  {n.type === "friend_request" &&
                    actionableRequestIds.has(n.id) && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRequestAction(n, "accept");
                          }}
                          disabled={actionLoadingId === n.id}
                          className="text-xs text-(--text-primary) font-medium px-3 py-1.5 rounded-lg bg-(--bg-card) hover:opacity-80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {tr.accept}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRequestAction(n, "decline");
                          }}
                          disabled={actionLoadingId === n.id}
                          className="text-xs text-(--text-primary)/40 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
