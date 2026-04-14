"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/context/auth";
import type { Notification } from "@/app/types/notifications";
import { typeLabel } from "@/app/types/notifications";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export default function NotificationsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = (await supabase
      .from("notifications")
      .select("*, sender:sender_id (username, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)) as { data: Notification[] | null; error: unknown };

    if (data) setNotifications(data);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          const newNotif = payload.new as Notification;
          if (newNotif.user_id === user.id) {
            loadNotifications();
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "Z"); // добавляем Z чтобы парсить как UTC
    return date.toLocaleString("ru", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-white/30 text-sm mt-0.5">Your activity</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">
            No notifications yet
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`flex items-center gap-3 p-4 rounded-xl transition-colors cursor-pointer
                  ${n.read ? "bg-[#2c2c2e]" : "bg-[#2c2c2e] border border-white/10"}`}
              >
                {/* Индикатор непрочитанного */}
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-white"}`}
                />

                {/* Аватар отправителя */}
                <div className="w-9 h-9 rounded-full bg-[#3a3a3c] flex items-center justify-center text-sm font-bold shrink-0">
                  {n.sender?.username?.charAt(0).toUpperCase()}
                </div>

                {/* Текст */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    <span className="font-medium">{n.sender?.username}</span>{" "}
                    <span className="text-white/50">{typeLabel(n.type)}</span>
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {formatDate(n.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
