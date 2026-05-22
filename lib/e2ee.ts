// ─────────────────────────────────────────────────────────────────────────────
// lib/e2ee.ts — End-to-End Encryption (RSA-OAEP + AES-GCM + Sender Key model)
// ─────────────────────────────────────────────────────────────────────────────
//
// Схема:
//   • Каждый пользователь имеет RSA-2048 пару: приватный ключ — только в localStorage,
//     публичный — на сервере (открыто).
//   • Для каждого диалога отправитель генерирует AES-256 «Sender Key».
//   • Sender Key шифруется RSA публичным ключом получателя и своим (self-backup),
//     затем оба варианта сохраняются на сервере.
//   • Сообщения шифруются AES-GCM с уникальным IV на каждое.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface E2EEKeyPair {
	publicKey: string // base64 SPKI
	privateKey: string // base64 PKCS8
}

export interface EncryptedPayload {
	iv: string // base64
	data: string // base64
}

// ─── RSA ─────────────────────────────────────────────────────────────────────

/**
 * Генерирует пару RSA-OAEP 2048-bit ключей.
 * Возвращает оба ключа в base64 (SPKI / PKCS8).
 */
export const generateRSAKeyPair = async (): Promise<E2EEKeyPair> => {
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

/**
 * Шифрует произвольную строку публичным RSA ключом получателя.
 * Используется для передачи Sender Key.
 */
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

/**
 * Расшифровывает строку, зашифрованную своим RSA публичным ключом.
 */
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

// ─── AES Sender Key ───────────────────────────────────────────────────────────

/**
 * Генерирует случайный AES-GCM-256 ключ.
 */
export const generateSenderKey = async (): Promise<string> => {
	const key = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	)
	const raw = await crypto.subtle.exportKey('raw', key)
	return bufToBase64(raw)
}

// ─── Шифрование / расшифровка сообщений ──────────────────────────────────────

/**
 * Шифрует сообщение AES-GCM с уникальным IV.
 * Формат результата: "base64(iv):base64(ciphertext)"
 */
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

/**
 * Расшифровывает сообщение, зашифрованное encryptMessage.
 * Бросает исключение при неверном ключе или повреждённых данных.
 */
export const decryptMessage = async (
	encryptedMessage: string,
	senderKeyB64: string
): Promise<string> => {
	const colonIdx = encryptedMessage.indexOf(':')
	if (colonIdx === -1) throw new Error('Invalid encrypted message format')

	const ivB64 = encryptedMessage.slice(0, colonIdx)
	const dataB64 = encryptedMessage.slice(colonIdx + 1)

	const key = await importAESKey(senderKeyB64)
	const iv = base64ToBuf(ivB64)
	const data = base64ToBuf(dataB64)

	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		data
	)
	return new TextDecoder().decode(decrypted)
}

/**
 * Проверяет, выглядит ли строка как зашифрованное сообщение.
 */
export const isEncrypted = (message: string): boolean =>
	message.includes(':') && isValidBase64(message.split(':')[0]!)

// ─── localStorage ─────────────────────────────────────────────────────────────

const PRIVATE_KEY_PREFIX = 'e2ee:private:'
const SENDER_KEY_PREFIX = 'e2ee:sender:'
const KEY_UPLOADED_PREFIX = 'e2ee:uploaded:'

export const savePrivateKey = (userId: string, key: string): void =>
	localStorage.setItem(`${PRIVATE_KEY_PREFIX}${userId}`, key)

export const getPrivateKey = (userId: string): string | null =>
	localStorage.getItem(`${PRIVATE_KEY_PREFIX}${userId}`)

export const removePrivateKey = (userId: string): void =>
	localStorage.removeItem(`${PRIVATE_KEY_PREFIX}${userId}`)

/**
 * conversationId = `${senderId}_${recipientId}`
 */
export const saveSenderKey = (conversationId: string, key: string): void =>
	localStorage.setItem(`${SENDER_KEY_PREFIX}${conversationId}`, key)

export const getSenderKey = (conversationId: string): string | null =>
	localStorage.getItem(`${SENDER_KEY_PREFIX}${conversationId}`)

export const removeSenderKey = (conversationId: string): void =>
	localStorage.removeItem(`${SENDER_KEY_PREFIX}${conversationId}`)

/**
 * Флаг: Sender Key для данного диалога реально загружен на сервер.
 * Отдельно от самого ключа, чтобы отличать «есть локально» от «загружен».
 */
export const markSenderKeyUploaded = (conversationId: string): void =>
	localStorage.setItem(`${KEY_UPLOADED_PREFIX}${conversationId}`, '1')

export const isSenderKeyUploaded = (conversationId: string): boolean =>
	localStorage.getItem(`${KEY_UPLOADED_PREFIX}${conversationId}`) === '1'

export const clearUploadedMark = (conversationId: string): void =>
	localStorage.removeItem(`${KEY_UPLOADED_PREFIX}${conversationId}`)

// ─── Утилиты расшифровки превью (без хука) ───────────────────────────────────

/**
 * Расшифровывает превью последнего сообщения в списке диалогов.
 * Не бросает исключений — возвращает fallback при любой ошибке.
 *
 * @param encryptedContent  зашифрованное сообщение
 * @param senderId          id отправителя сообщения
 * @param currentUserId     id текущего пользователя
 * @param otherUserId       id собеседника (нужен для поиска своего SenderKey)
 */
export const decryptPreview = async (
	encryptedContent: string,
	senderId: string,
	currentUserId: string,
	otherUserId: string
): Promise<string> => {
	try {
		if (!isEncrypted(encryptedContent)) return encryptedContent

		// Своё сообщение → свой Sender Key (conversationId = currentUser_other)
		if (senderId === currentUserId) {
			const conversationId = `${currentUserId}_${otherUserId}`
			const senderKey = getSenderKey(conversationId)
			if (!senderKey) return '🔒 Сообщение'
			return await decryptMessage(encryptedContent, senderKey)
		}

		// Чужое сообщение → Sender Key собеседника (conversationId = sender_currentUser)
		const conversationId = `${senderId}_${currentUserId}`
		const senderKey = getSenderKey(conversationId)
		if (!senderKey) return '🔒 Сообщение'
		return await decryptMessage(encryptedContent, senderKey)
	} catch {
		return '🔒 Сообщение'
	}
}

// ─── Вспомогательные функции ──────────────────────────────────────────────────

export const bufToBase64 = (buf: ArrayBuffer | Uint8Array): string =>
	btoa(String.fromCharCode(...new Uint8Array(buf)))

export const base64ToBuf = (b64: string): ArrayBuffer => {
	const binary = atob(b64)
	const buf = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
	return buf.buffer
}

const isValidBase64 = (str: string): boolean => {
	try {
		return btoa(atob(str)) === str
	} catch {
		return false
	}
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
