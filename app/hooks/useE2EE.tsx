import {
	clearAllUploadedMarks,
	decryptMessage,
	encryptMessage,
	generateRSAKeyPair,
	generateSenderKey,
	getPrivateKey,
	getSenderKey,
	isEncrypted,
	removeSenderKey,
	rsaDecrypt,
	rsaEncrypt,
	savePrivateKey,
	saveSenderKey
} from '@/lib/e2ee'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── API ──────────────────────────────────────────────────────────────────────

const api = {
	uploadPublicKey: (publicKey: string) =>
		fetch('/api/keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ publicKey })
		}),

	getPublicKey: async (userId: string): Promise<string | null> => {
		try {
			const res = await fetch(`/api/keys?userId=${userId}`)
			if (!res.ok) return null
			const data = await res.json()
			return data.publicKey ?? null
		} catch {
			return null
		}
	},

	uploadSenderKey: (recipientId: string, encryptedKey: string) =>
		fetch('/api/sender-keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ recipientId, encryptedKey })
		}),

	getSenderKey: async (senderId: string): Promise<string | null> => {
		try {
			const res = await fetch(`/api/sender-keys?senderId=${senderId}`)
			if (!res.ok) return null
			const data = await res.json()
			return data.encryptedKey ?? null
		} catch {
			return null
		}
	},

	uploadSelfBackup: (encryptedKey: string) =>
		fetch('/api/sender-keys/own', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ encryptedKey })
		}),

	getSelfBackup: async (): Promise<string | null> => {
		try {
			const res = await fetch('/api/sender-keys/own')
			if (!res.ok) return null
			const data = await res.json()
			return data.encryptedKey ?? null
		} catch {
			return null
		}
	}
}

// ─── Хук ─────────────────────────────────────────────────────────────────────

interface UseE2EEReturn {
	ready: boolean
	encrypt: (message: string) => Promise<string | null>
	decrypt: (encryptedMsg: string, senderId: string) => Promise<string>
}

export const useE2EE = (recipientId?: string): UseE2EEReturn => {
	const { data: session } = useSession()
	const userId = session?.user?.id

	const [rsaReady, setRsaReady] = useState(false)
	const [senderKeyReady, setSenderKeyReady] = useState(false)
	// Счётчик повторных попыток когда у получателя нет RSA ключа
	const [retryCount, setRetryCount] = useState(0)

	const mySenderKeyRef = useRef<string | null>(null)
	const incomingKeysRef = useRef<Map<string, string>>(new Map())

	// ── Шаг 1: RSA ───────────────────────────────────────────────────────────

	useEffect(() => {
		if (!userId) return

		const init = async () => {
			const regenerate = async () => {
				const { publicKey, privateKey } = await generateRSAKeyPair()
				savePrivateKey(userId, privateKey)
				await api.uploadPublicKey(publicKey)
				clearAllUploadedMarks()
				incomingKeysRef.current.clear()
				setRsaReady(true)
			}

			const existingPrivate = getPrivateKey(userId)
			if (!existingPrivate) {
				await regenerate()
				return
			}

			const serverKey = await api.getPublicKey(userId)
			if (!serverKey) {
				await regenerate()
				return
			}

			setRsaReady(true)
		}

		void init()
	}, [userId])

	// ── Шаг 2: Sender Key ─────────────────────────────────────────────────────
	//
	// Ключевой принцип: ВСЕГДА перезагружаем SenderKey при открытии чата.
	// Это решает два сценария:
	//   а) Первое открытие: у получателя не было RSA ключа → retryCount поднимает
	//      счётчик каждые 4 сек пока получатель не зарегистрируется
	//   б) Получатель сменил браузер → новый RSA ключ → мы шифруем под новый

	useEffect(() => {
		if (!rsaReady || !userId || !recipientId) return

		const initSenderKey = async () => {
			setSenderKeyReady(false)
			mySenderKeyRef.current = null

			const conversationId = `${userId}_${recipientId}`

			// Берём существующий ключ или генерируем новый
			const myKey = getSenderKey(conversationId) ?? (await generateSenderKey())
			saveSenderKey(conversationId, myKey)
			mySenderKeyRef.current = myKey

			// Получаем текущий RSA публичный ключ получателя
			const recipientPublicKey = await api.getPublicKey(recipientId)

			if (!recipientPublicKey) {
				// Получатель ещё не зарегистрировал RSA ключ.
				// retryEffect ниже поднимет retryCount → этот effect перезапустится.
				return
			}

			// Всегда перешифровываем под актуальный RSA ключ получателя.
			// Если получатель сменил браузер — здесь подхватим его новый ключ.
			const encryptedForRecipient = await rsaEncrypt(myKey, recipientPublicKey)
			await api.uploadSenderKey(recipientId, encryptedForRecipient)

			// Self-backup: шифруем своим RSA для восстановления при смене браузера
			const myPublicKey = await api.getPublicKey(userId)
			if (myPublicKey) {
				const encryptedSelf = await rsaEncrypt(myKey, myPublicKey)
				void api.uploadSelfBackup(encryptedSelf)
			}

			setSenderKeyReady(true)
		}

		void initSenderKey()
	}, [rsaReady, userId, recipientId, retryCount])

	// Retry: если senderKeyReady=false (получатель не зарегистрирован),
	// повторяем попытку каждые 4 секунды
	useEffect(() => {
		if (senderKeyReady || !rsaReady || !userId || !recipientId) return
		const t = setTimeout(() => setRetryCount(c => c + 1), 4000)
		return () => clearTimeout(t)
	}, [senderKeyReady, rsaReady, userId, recipientId, retryCount])

	// ── Входящие: получить SenderKey отправителя ──────────────────────────────

	const getSenderKeyFor = useCallback(
		async (senderId: string, forceRefresh = false): Promise<string | null> => {
			if (!userId) return null

			const conversationId = `${senderId}_${userId}`

			if (!forceRefresh) {
				const memCached = incomingKeysRef.current.get(senderId)
				if (memCached) return memCached

				const local = getSenderKey(conversationId)
				if (local) {
					incomingKeysRef.current.set(senderId, local)
					return local
				}
			} else {
				incomingKeysRef.current.delete(senderId)
				removeSenderKey(conversationId)
			}

			// Запрашиваем с сервера
			const encryptedKey = await api.getSenderKey(senderId)
			if (!encryptedKey) return null

			const privateKey = getPrivateKey(userId)
			if (!privateKey) return null

			try {
				const senderKey = await rsaDecrypt(encryptedKey, privateKey)
				saveSenderKey(conversationId, senderKey)
				incomingKeysRef.current.set(senderId, senderKey)
				return senderKey
			} catch {
				// RSA расшифровка не удалась: ключ зашифрован под другой RSA
				return null
			}
		},
		[userId]
	)

	// ── Публичные методы ───────────────────────────────────────────────────────

	const encrypt = useCallback(
		async (message: string): Promise<string | null> => {
			if (!mySenderKeyRef.current || !senderKeyReady) return null
			return encryptMessage(message, mySenderKeyRef.current)
		},
		[senderKeyReady]
	)

	const decrypt = useCallback(
		async (encryptedMsg: string, senderId: string): Promise<string> => {
			if (!userId) return encryptedMsg

			try {
				if (!isEncrypted(encryptedMsg)) return encryptedMsg

				// Своё сообщение
				if (senderId === userId) {
					const key =
						mySenderKeyRef.current ??
						(await restoreOwnSenderKey(userId, recipientId))
					if (!key) return '[Ключ не найден]'
					return await decryptMessage(encryptedMsg, key)
				}

				// Входящее сообщение
				const senderKey = await getSenderKeyFor(senderId)
				if (!senderKey) return '[Ключ не получен]'

				try {
					return await decryptMessage(encryptedMsg, senderKey)
				} catch {
					// AES упала — ключ устарел, берём свежий с сервера
					const freshKey = await getSenderKeyFor(senderId, true)
					if (!freshKey) return '[Ключ устарел]'
					return await decryptMessage(encryptedMsg, freshKey)
				}
			} catch {
				return '[Ошибка расшифровки]'
			}
		},
		[userId, recipientId, getSenderKeyFor]
	)

	return { ready: rsaReady && senderKeyReady, encrypt, decrypt }
}

// ─── Восстановление своего Sender Key из self-backup ─────────────────────────

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
			saveSenderKey(`${userId}_${recipientId}`, senderKey)
		}

		return senderKey
	} catch {
		return null
	}
}
