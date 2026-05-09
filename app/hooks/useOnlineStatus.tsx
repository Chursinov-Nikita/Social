import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type OnlineData = {
  online: boolean;
  lastSeen: string | null;
};

export const useOnlineStatus = (userIds: string[]) => {
  const { data: session } = useSession();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!session?.user?.id) return;

    const ping = () => fetch("/api/chat/online", { method: "POST" });
    void ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!userIds.length) return;

    const fetchStatus = async () => {
      const res = await fetch(`/api/chat/online?ids=${userIds.join(",")}`);
      if (!res.ok) return;
      const data: Record<string, OnlineData> = await res.json();

      const online = new Set<string>();
      const seen: Record<string, string> = {};

      for (const [id, info] of Object.entries(data)) {
        if (info.online) online.add(id);
        if (info.lastSeen) seen[id] = info.lastSeen;
      }

      setOnlineUsers(online);
      setLastSeen(seen);
    };

    void fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [userIds.join(",")]);

  return { onlineUsers, lastSeen };
};
