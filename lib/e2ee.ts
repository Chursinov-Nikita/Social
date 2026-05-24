// ─────────────────────────────────────────────────────────────────────────────
// lib/e2ee.ts
// ─────────────────────────────────────────────────────────────────────────────

// ─── RSA ─────────────────────────────────────────────────────────────────────

export const generateRSAKeyPair = async () => {
	const keyPair = await crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['encrypt', 'decrypt']
	)

	const [publicKey, privateKey] = await Promise.all([
		crypto.subtle.exportKey('spki', keyPair.publicKey),
		crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
	])

	return {
		publicKey: bufToBase64(publicKey),
		privateKey: bufToBase64(privateKey)
	}
}

export const rsaEncrypt = async (
	plaintext: string,
	recipientPublicKeyB64: string
): Promise<string> => {
	const publicKey = await importRSAPublicKey(recipientPublicKeyB64)
	const encoded = new TextEncoder().encode(plaintext)
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'RSA-OAEP' },
		publicKey,
		encoded
	)
	return bufToBase64(encrypted)
}

export const rsaDecrypt = async (
	ciphertextB64: string,
	privateKeyB64: string
): Promise<string> => {
	const privateKey = await importRSAPrivateKey(privateKeyB64)
	const encrypted = base64ToBuf(ciphertextB64)
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'RSA-OAEP' },
		privateKey,
		encrypted
	)
	return new TextDecoder().decode(decrypted)
}

// Алиасы для обратной совместимости
export const encryptSenderKey = rsaEncrypt
export const decryptSenderKey = rsaDecrypt

// ─── AES ─────────────────────────────────────────────────────────────────────

export const generateSenderKey = async (): Promise<string> => {
	const key = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	)
	const raw = await crypto.subtle.exportKey('raw', key)
	return bufToBase64(raw)
}

export const encryptMessage = async (
	message: string,
	senderKeyB64: string
): Promise<string> => {
	const key = await importAESKey(senderKeyB64)
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const encoded = new TextEncoder().encode(message)
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		encoded
	)
	return `${bufToBase64(iv)}:${bufToBase64(encrypted)}`
}

export const decryptMessage = async (
	encryptedMessage: string,
	senderKeyB64: string
): Promise<string> => {
	const colonIdx = encryptedMessage.indexOf(':')
	if (colonIdx === -1) throw new Error('Invalid format')
	const key = await importAESKey(senderKeyB64)
	const iv = base64ToBuf(encryptedMessage.slice(0, colonIdx))
	const data = base64ToBuf(encryptedMessage.slice(colonIdx + 1))
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		data
	)
	return new TextDecoder().decode(decrypted)
}

export const isEncrypted = (msg: string): boolean =>
	typeof msg === 'string' && msg.includes(':')

// ─── localStorage ─────────────────────────────────────────────────────────────
//
// Все ключи под префиксом e2ee: для изоляции.
// При первом чтении мигрируем старые ключи (без префикса) автоматически.
//

const PRIVATE_KEY_PREFIX = 'e2ee:private:'
const SENDER_KEY_PREFIX = 'e2ee:sender:'
const UPLOADED_FLAG_PREFIX = 'e2ee:uploaded:'

// ── Приватный RSA ключ ────────────────────────────────────────────────────────

export const savePrivateKey = (userId: string, key: string): void =>
	localStorage.setItem(`${PRIVATE_KEY_PREFIX}${userId}`, key)

export const getPrivateKey = (userId: string): string | null => {
	const modern = localStorage.getItem(`${PRIVATE_KEY_PREFIX}${userId}`)
	if (modern) return modern

	// Миграция старого формата
	const legacy = localStorage.getItem(`private_key_${userId}`)
	if (legacy) {
		localStorage.setItem(`${PRIVATE_KEY_PREFIX}${userId}`, legacy)
		localStorage.removeItem(`private_key_${userId}`)
		return legacy
	}
	return null
}

// ── Sender Key ────────────────────────────────────────────────────────────────

export const saveSenderKey = (conversationId: string, key: string): void =>
	localStorage.setItem(`${SENDER_KEY_PREFIX}${conversationId}`, key)

export const getSenderKey = (conversationId: string): string | null => {
	const modern = localStorage.getItem(`${SENDER_KEY_PREFIX}${conversationId}`)
	if (modern) return modern

	// Миграция старого формата
	const legacy = localStorage.getItem(`sender_key_${conversationId}`)
	if (legacy) {
		localStorage.setItem(`${SENDER_KEY_PREFIX}${conversationId}`, legacy)
		localStorage.removeItem(`sender_key_${conversationId}`)
		return legacy
	}
	return null
}

export const removeSenderKey = (conversationId: string): void => {
	localStorage.removeItem(`${SENDER_KEY_PREFIX}${conversationId}`)
	localStorage.removeItem(`${UPLOADED_FLAG_PREFIX}${conversationId}`)
}

// ── Флаг: SenderKey загружен на сервер ───────────────────────────────────────

export const markSenderKeyUploaded = (conversationId: string): void =>
	localStorage.setItem(`${UPLOADED_FLAG_PREFIX}${conversationId}`, '1')

export const isSenderKeyUploaded = (conversationId: string): boolean =>
	localStorage.getItem(`${UPLOADED_FLAG_PREFIX}${conversationId}`) === '1'

export const clearAllUploadedMarks = (): void => {
	const toRemove: string[] = []
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i)
		if (k?.startsWith(UPLOADED_FLAG_PREFIX)) toRemove.push(k)
	}
	toRemove.forEach(k => localStorage.removeItem(k))
}

// ── decryptPreview ────────────────────────────────────────────────────────────

/**
 * Расшифровывает превью сообщения для списка диалогов.
 *
 * @param encryptedContent  зашифрованное сообщение
 * @param senderId          id отправителя
 * @param currentUserId     id текущего пользователя
 * @param otherUserId       id собеседника (второй участник диалога)
 */
export const decryptPreview = async (
	encryptedContent: string,
	senderId: string,
	currentUserId: string,
	otherUserId: string
): Promise<string> => {
	try {
		if (!isEncrypted(encryptedContent)) return encryptedContent

		const conversationId =
			senderId === currentUserId
				? `${currentUserId}_${otherUserId}` // своё → ключ currentUser_other
				: `${senderId}_${currentUserId}` // чужое → ключ sender_currentUser

		const senderKey = getSenderKey(conversationId)
		if (!senderKey) return '🔒 Сообщение'
		return await decryptMessage(encryptedContent, senderKey)
	} catch {
		return '🔒 Сообщение'
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const bufToBase64 = (buf: ArrayBuffer | Uint8Array): string =>
	btoa(String.fromCharCode(...new Uint8Array(buf)))

export const base64ToBuf = (b64: string): ArrayBuffer => {
	const binary = atob(b64)
	const buf = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
	return buf.buffer
}

const importRSAPublicKey = (b64: string): Promise<CryptoKey> =>
	crypto.subtle.importKey(
		'spki',
		base64ToBuf(b64),
		{ name: 'RSA-OAEP', hash: 'SHA-256' },
		false,
		['encrypt']
	)

const importRSAPrivateKey = (b64: string): Promise<CryptoKey> =>
	crypto.subtle.importKey(
		'pkcs8',
		base64ToBuf(b64),
		{ name: 'RSA-OAEP', hash: 'SHA-256' },
		false,
		['decrypt']
	)

const importAESKey = (b64: string): Promise<CryptoKey> =>
	crypto.subtle.importKey('raw', base64ToBuf(b64), { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	])
