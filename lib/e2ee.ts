// ─── RSA ключи (асимметричные) ───────────────────────────────

export const generateRSAKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: bufToBase64(publicKey),
    privateKey: bufToBase64(privateKey),
  };
};

// ─── AES Sender Key (симметричный) ───────────────────────────

export const generateSenderKey = async (): Promise<string> => {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToBase64(raw);
};

// ─── Шифрование Sender Key через RSA (для передачи) ──────────

export const encryptSenderKey = async (
  senderKeyB64: string,
  recipientPublicKeyB64: string,
): Promise<string> => {
  const publicKey = await importRSAPublicKey(recipientPublicKeyB64);
  const encoded = new TextEncoder().encode(senderKeyB64);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoded,
  );
  return bufToBase64(encrypted);
};

export const decryptSenderKey = async (
  encryptedSenderKeyB64: string,
  privateKeyB64: string,
): Promise<string> => {
  const privateKey = await importRSAPrivateKey(privateKeyB64);
  const encrypted = base64ToBuf(encryptedSenderKeyB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
};

// ─── Шифрование сообщений через AES Sender Key ───────────────

export const encryptMessage = async (
  message: string,
  senderKeyB64: string,
): Promise<string> => {
  const key = await importAESKey(senderKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(message);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  // Формат: iv:encrypted
  return `${bufToBase64(iv)}:${bufToBase64(encrypted)}`;
};

export const decryptMessage = async (
  encryptedMessage: string,
  senderKeyB64: string,
): Promise<string> => {
  const [ivB64, dataB64] = encryptedMessage.split(":");
  const key = await importAESKey(senderKeyB64);
  const iv = base64ToBuf(ivB64);
  const data = base64ToBuf(dataB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return new TextDecoder().decode(decrypted);
};

// ─── Локальное хранилище ключей ───────────────────────────────

export const savePrivateKey = (userId: string, key: string) =>
  localStorage.setItem(`private_key_${userId}`, key);

export const getPrivateKey = (userId: string): string | null =>
  localStorage.getItem(`private_key_${userId}`);

export const saveSenderKey = (conversationId: string, key: string) =>
  localStorage.setItem(`sender_key_${conversationId}`, key);

export const getSenderKey = (conversationId: string): string | null =>
  localStorage.getItem(`sender_key_${conversationId}`);

// ─── Вспомогательные функции ──────────────────────────────────

const bufToBase64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const base64ToBuf = (b64: string): ArrayBuffer => {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
};

const importRSAPublicKey = async (b64: string) =>
  crypto.subtle.importKey(
    "spki",
    base64ToBuf(b64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );

const importRSAPrivateKey = async (b64: string) =>
  crypto.subtle.importKey(
    "pkcs8",
    base64ToBuf(b64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );

const importAESKey = async (b64: string) =>
  crypto.subtle.importKey("raw", base64ToBuf(b64), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);

// Утилита для расшифровки превью без хука
export const decryptPreview = async (
  encryptedContent: string,
  senderId: string,
  currentUserId: string,
): Promise<string> => {
  try {
    if (!encryptedContent.includes(":")) return encryptedContent;

    // Своё сообщение — используем свой Sender Key
    if (senderId === currentUserId) {
      const conversationId = `${currentUserId}_`;
      // Ищем подходящий ключ по префиксу
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`sender_key_${currentUserId}_`)) {
          const senderKey = localStorage.getItem(key);
          if (senderKey) {
            try {
              return await decryptMessage(encryptedContent, senderKey);
            } catch {
              continue;
            }
          }
        }
      }
      return "🔒 Сообщение";
    }

    // Чужое сообщение — ищем Sender Key отправителя
    const conversationId = `${senderId}_${currentUserId}`;
    const senderKey = localStorage.getItem(`sender_key_${conversationId}`);
    if (!senderKey) return "🔒 Сообщение";
    return await decryptMessage(encryptedContent, senderKey);
  } catch {
    return "🔒 Сообщение";
  }
};
