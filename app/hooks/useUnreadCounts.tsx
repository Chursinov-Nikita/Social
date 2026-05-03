import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export const useUnreadCounts = () => {
  const { data: session } = useSession();
  const [messages, setMessages] = useState(0);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) {
      setMessages(0);
      setNotifications(0);
      return;
    }

    const es = new EventSource("/api/sse");

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages(data.messages ?? 0);
      setNotifications(data.notifications ?? 0);
    };

    es.onerror = () => es.close();

    return () => es.close();
  }, [session?.user?.id]);

  return { messages, notifications };
};
