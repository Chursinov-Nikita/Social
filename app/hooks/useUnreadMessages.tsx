import { useState, useEffect, useMemo } from "react";
import { createClient } from "../lib/supabase/client";
import { useAuth } from "../context/auth";

const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!user) {
      setTimeout(() => setUnreadCount(0), 0);
      return;
    }

    const fetchUnread = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id")
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadCount(data?.length ?? 0);
    };

    void fetchUnread();

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          void fetchUnread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  return unreadCount;
};

export default useUnreadMessages;
