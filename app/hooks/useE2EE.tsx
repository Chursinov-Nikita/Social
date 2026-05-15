import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateRSAKeyPair,
  generateSenderKey,
  encryptSenderKey,
  decryptSenderKey,
  encryptMessage,
  decryptMessage,
  savePrivateKey,
  getPrivateKey,
  saveSenderKey,
  getSenderKey,
} from "@/lib/e2ee";

export const useE2EE = (recipientId?: string) => {
  const { data: session } = useSession();
  const [ready, setReady] = useState(false);
  const mySenderKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const init = async () => {
      if (!getPrivateKey(session?.user?.id || "")) {
        const { publicKey, privateKey } = await generateRSAKeyPair();
        savePrivateKey(session?.user?.id || "", privateKey);
        await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey }),
        });
      }
      setReady(true);
    };
    void init();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!ready || !session?.user?.id || !recipientId) return;
    const initSenderKey = async () => {
      const conversationId = `${session?.user?.id}_${recipientId}`;
      const cached = getSenderKey(conversationId);
      if (cached) {
        mySenderKeyRef.current = cached;
        return;
      }

      const newKey = await generateSenderKey();
      saveSenderKey(conversationId, newKey);
      mySenderKeyRef.current = newKey;

      const res = await fetch(`/api/keys?userId=${recipientId}`);
      const { publicKey } = await res.json();
      if (!publicKey) return;

      const encrypted = await encryptSenderKey(newKey, publicKey);
      await fetch("/api/sender-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, encryptedKey: encrypted }),
      });
    };
    void initSenderKey();
  }, [ready, session?.user?.id, recipientId]);

  const getSenderKeyFor = useCallback(
    async (senderId: string) => {
      if (!session?.user?.id) return null;
      const conversationId = `${senderId}_${session.user.id}`;
      const cached = getSenderKey(conversationId);
      if (cached) return cached;

      const res = await fetch(`/api/sender-keys?senderId=${senderId}`);
      const { encryptedKey } = await res.json();
      if (!encryptedKey) return null;

      const privateKey = getPrivateKey(session.user.id);
      if (!privateKey) return null;

      const senderKey = await decryptSenderKey(encryptedKey, privateKey);
      saveSenderKey(conversationId, senderKey);
      return senderKey;
    },
    [session?.user?.id],
  );

  const encrypt = useCallback(async (message: string) => {
    const key = mySenderKeyRef.current;
    if (!key) return null;
    return encryptMessage(message, key);
  }, []);

  const decrypt = useCallback(
    async (encryptedMsg: string, senderId: string) => {
      if (!session?.user?.id) return encryptedMsg;
      try {
        if (!encryptedMsg.includes(":")) return encryptedMsg;
        if (senderId === session.user.id) {
          const key = mySenderKeyRef.current;
          if (!key) return "[Ключ не найден]";
          return await decryptMessage(encryptedMsg, key);
        }
        const senderKey = await getSenderKeyFor(senderId);
        if (!senderKey) return "[Ключ не получен]";
        return await decryptMessage(encryptedMsg, senderKey);
      } catch {
        return "[Ошибка расшифровки]";
      }
    },
    [session?.user?.id, getSenderKeyFor],
  );

  return {
    ready: ready && !!mySenderKeyRef.current,
    encrypt,
    decrypt,
  };
};
