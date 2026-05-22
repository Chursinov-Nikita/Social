// ─────────────────────────────────────────────────────────────────────────────
// hooks/useE2EE.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// Жизненный цикл:
//
//  1. При монтировании (session ready):
//     - Проверяем наличие RSA private key в localStorage.
//     - Если нет — генерируем пару, сохраняем приватный локально,
//       загружаем публичный на сервер.
//
//  2. При открытии диалога (recipientId ready):
//     - Проверяем: есть ли SenderKey локально И был ли он загружен на сервер.
//     - Если оба условия выполнены — готово.
//     - Иначе: пытаемся (пере)загрузить SenderKey получателю.
//       Если публичный ключ получателя ещё не доступен — ставим флаг pending,
//       откладываем до следующего открытия / повторной попытки.
//
//  3. encrypt / decrypt — публичные методы для компонентов.
//
// ─────────────────────────────────────────────────────────────────────────────

import {
	decryptMessage,
	encryptMessage,
	generateRSAKeyPair,
	generateSenderKey,
	getPrivateKey,
	getSenderKey,
	isEncrypted,
	isSenderKeyUploaded,
	markSenderKeyUploaded,
	rsaDecrypt,
	rsaEncrypt,
	savePrivateKey,
	saveSenderKey
} from '@/lib/e2ee'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Вспомогательные API-функции ─────────────────────────────────────────────

const api = {
	/** Загружает публичный RSA ключ текущего пользователя на сервер */
	uploadPublicKey: (publicKey: string) =>
		fetch('/api/keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ publicKey })
		}),

	/** Получает публичный RSA ключ пользователя по id */
	getPublicKey: async (userId: string): Promise<string | null> => {
		const res = await fetch(`/api/keys?userId=${userId}`)
		if (!res.ok) return null
		const { publicKey } = await res.json()
		return publicKey ?? null
	},

	/** Загружает зашифрованный Sender Key для получателя */
	uploadSenderKey: (recipientId: string, encryptedKey: string) =>
		fetch('/api/sender-keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ recipientId, encryptedKey })
		}),

	/** Получает зашифрованный Sender Key отправителя (для расшифровки входящих) */
	getSenderKey: async (senderId: string): Promise<string | null> => {
		const res = await fetch(`/api/sender-keys?senderId=${senderId}`)
		if (!res.ok) return null
		const { encryptedKey } = await res.json()
		return encryptedKey ?? null
	},

	/** Загружает self-backup Sender Key, зашифрованный своим RSA */
	uploadSelfBackup: (encryptedKey: string) =>
		fetch('/api/sender-keys/own', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ encryptedKey })
		}),

	/** Получает self-backup Sender Key (при смене браузера) */
	getSelfBackup: async (): Promise<string | null> => {
		const res = await fetch('/api/sender-keys/own')
		if (!res.ok) return null
		const { encryptedKey } = await res.json()
		return encryptedKey ?? null
	}
}

// ─── Хук ─────────────────────────────────────────────────────────────────────

interface UseE2EEReturn {
	/** true когда ключи инициализированы и можно шифровать/расшифровывать */
	ready: boolean
	/** Шифрует сообщение своим Sender Key. Возвращает null если ключ не готов. */
	encrypt: (message: string) => Promise<string | null>
	/** Расшифровывает сообщение. senderId — автор сообщения. */
	decrypt: (encryptedMsg: string, senderId: string) => Promise<string>
}

export const useE2EE = (recipientId?: string): UseE2EEReturn => {
	const { data: session } = useSession()
	const userId = session?.user?.id

	// true когда RSA ключи готовы
	const [rsaReady, setRsaReady] = useState(false)
	// true когда SenderKey для текущего диалога загружен на сервер
	const [senderKeyReady, setSenderKeyReady] = useState(false)

	// Sender Key текущего диалога (исходящие сообщения)
	const mySenderKeyRef = useRef<string | null>(null)
	// Кэш расшифрованных Sender Key входящих (senderId → ключ)
	const incomingSenderKeysRef = useRef<Map<string, string>>(new Map())

	// ── Шаг 1: RSA инициализация ────────────────────────────────────────────────
	useEffect(() => {
		if (!userId) return

		const initRSA = async () => {
			const existingPrivateKey = getPrivateKey(userId)

			if (existingPrivateKey) {
				// Приватный ключ есть локально — проверяем, загружен ли публичный на сервер
				const serverPublicKey = await api.getPublicKey(userId)
				if (!serverPublicKey) {
					// Приватный ключ есть, но публичный не загружен — загружаем заново.
					// Публичный ключ придётся восстановить через перегенерацию.
					await regenerateRSAKeys(userId)
				} else {
					setRsaReady(true)
				}
				return
			}

			// Приватного ключа нет — проверяем, есть ли self-backup Sender Key на сервере.
			// Это значит пользователь уже был зарегистрирован, просто сменил браузер.
			await regenerateRSAKeys(userId)
		}

		void initRSA()
	}, [userId])

	const regenerateRSAKeys = async (uid: string) => {
		const { publicKey, privateKey } = await generateRSAKeyPair()
		savePrivateKey(uid, privateKey)
		await api.uploadPublicKey(publicKey)

		// Все ранее загруженные Sender Key теперь зашифрованы старым RSA —
		// они станут нерасшифруемыми. Сбрасываем флаги загрузки.
		// (Sender Key в localStorage оставляем — они ещё пригодятся для исходящих.)
		clearAllUploadedMarks()

		setRsaReady(true)
	}

	// ── Шаг 2: Sender Key для диалога ──────────────────────────────────────────
	useEffect(() => {
		if (!rsaReady || !userId || !recipientId) return

		setSenderKeyReady(false)
		mySenderKeyRef.current = null

		const initSenderKey = async () => {
			const conversationId = `${userId}_${recipientId}`
			const cachedKey = getSenderKey(conversationId)
			const alreadyUploaded = isSenderKeyUploaded(conversationId)

			// Ключ есть локально и уже загружен на сервер — всё готово
			if (cachedKey && alreadyUploaded) {
				mySenderKeyRef.current = cachedKey
				setSenderKeyReady(true)
				return
			}

			// Нужно (пере)загрузить Sender Key получателю
			const recipientPublicKey = await api.getPublicKey(recipientId)

			if (!recipientPublicKey) {
				// Получатель ещё не зарегистрировал RSA ключ.
				// Сохраняем Sender Key локально — загрузим при следующей возможности.
				if (!cachedKey) {
					const newKey = await generateSenderKey()
					saveSenderKey(conversationId, newKey)
					mySenderKeyRef.current = newKey
				} else {
					mySenderKeyRef.current = cachedKey
				}
				// senderKeyReady остаётся false — encrypt вернёт null,
				// пока ключ не будет загружен получателю.
				// Компонент должен показать состояние ожидания.
				return
			}

			// Публичный ключ получателя доступен
			const keyToUpload = cachedKey ?? (await generateSenderKey())
			if (!cachedKey) saveSenderKey(conversationId, keyToUpload)
			mySenderKeyRef.current = keyToUpload

			// Шифруем Sender Key для получателя и загружаем
			const encryptedForRecipient = await rsaEncrypt(
				keyToUpload,
				recipientPublicKey
			)
			await api.uploadSenderKey(recipientId, encryptedForRecipient)
			markSenderKeyUploaded(conversationId)

			// Self-backup: шифруем своим RSA и загружаем
			// (позволяет восстановить ключ при смене браузера)
			const myPublicKey = await api.getPublicKey(userId)
			if (myPublicKey) {
				const encryptedSelf = await rsaEncrypt(keyToUpload, myPublicKey)
				await api.uploadSelfBackup(encryptedSelf)
			}

			setSenderKeyReady(true)
		}

		void initSenderKey()
	}, [rsaReady, userId, recipientId])

	// ── Получить Sender Key входящего отправителя ───────────────────────────────

	const getSenderKeyFor = useCallback(
		async (senderId: string): Promise<string | null> => {
			if (!userId) return null

			// Проверяем кэш в памяти
			const cached = incomingSenderKeysRef.current.get(senderId)
			if (cached) return cached

			// Проверяем localStorage
			const conversationId = `${senderId}_${userId}`
			const localKey = getSenderKey(conversationId)
			if (localKey) {
				incomingSenderKeysRef.current.set(senderId, localKey)
				return localKey
			}

			// Запрашиваем зашифрованный Sender Key с сервера
			const encryptedKey = await api.getSenderKey(senderId)
			if (!encryptedKey) return null

			const privateKey = getPrivateKey(userId)
			if (!privateKey) return null

			try {
				const senderKey = await rsaDecrypt(encryptedKey, privateKey)
				saveSenderKey(conversationId, senderKey)
				incomingSenderKeysRef.current.set(senderId, senderKey)
				return senderKey
			} catch {
				// Расшифровка не удалась — скорее всего ключ был зашифрован
				// под старый RSA (после смены браузера отправителем).
				return null
			}
		},
		[userId]
	)

	// ── Публичные методы ────────────────────────────────────────────────────────

	const encrypt = useCallback(
		async (message: string): Promise<string | null> => {
			const key = mySenderKeyRef.current
			if (!key || !senderKeyReady) return null
			return encryptMessage(message, key)
		},
		[senderKeyReady]
	)

	const decrypt = useCallback(
		async (encryptedMsg: string, senderId: string): Promise<string> => {
			if (!userId) return encryptedMsg

			try {
				if (!isEncrypted(encryptedMsg)) return encryptedMsg

				// Своё сообщение → расшифровываем своим Sender Key
				if (senderId === userId) {
					const key = mySenderKeyRef.current
					if (!key) {
						// Sender Key не в памяти — пробуем восстановить self-backup
						const restored = await restoreOwnSenderKey(userId, recipientId)
						if (!restored) return '[Ключ не найден]'
						return await decryptMessage(encryptedMsg, restored)
					}
					return await decryptMessage(encryptedMsg, key)
				}

				// Чужое сообщение → ищем Sender Key отправителя
				const senderKey = await getSenderKeyFor(senderId)
				if (!senderKey) return '[Ключ не получен]'
				return await decryptMessage(encryptedMsg, senderKey)
			} catch {
				return '[Ошибка расшифровки]'
			}
		},
		[userId, recipientId, getSenderKeyFor]
	)

	return {
		ready: rsaReady && senderKeyReady,
		encrypt,
		decrypt
	}
}

// ─── Вспомогательные функции хука ────────────────────────────────────────────

/**
 * Восстанавливает свой Sender Key из self-backup на сервере.
 * Вызывается когда mySenderKeyRef пуст (например, после перезагрузки
 * страницы в ситуации, когда localStorage был очищен между сессиями).
 */
async function restoreOwnSenderKey(
	userId: string,
	recipientId?: string
): Promise<string | null> {
	try {
		const encryptedBackup = await api.getSelfBackup()
		if (!encryptedBackup) return null

		const privateKey = getPrivateKey(userId)
		if (!privateKey) return null

		const senderKey = await rsaDecrypt(encryptedBackup, privateKey)

		if (recipientId) {
			const conversationId = `${userId}_${recipientId}`
			saveSenderKey(conversationId, senderKey)
			markSenderKeyUploaded(conversationId)
		}

		return senderKey
	} catch {
		return null
	}
}

/**
 * Сбрасывает флаги "загружено" для всех Sender Key в localStorage.
 * Вызывается при перегенерации RSA ключей.
 */
function clearAllUploadedMarks() {
	const keysToRemove: string[] = []
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)
		if (key?.startsWith('e2ee:uploaded:')) keysToRemove.push(key)
	}
	keysToRemove.forEach(key => localStorage.removeItem(key))
}
