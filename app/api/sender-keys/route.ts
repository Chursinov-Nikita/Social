import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

/**
 * Получает зашифрованный Sender Key отправителя для текущего пользователя.
 * senderId — id пользователя, чьи сообщения нужно расшифровать.
 */
export async function GET(req: NextRequest) {
	const session = await auth()
	if (!session?.user?.id)
		return Response.json({ error: 'Unauthorized' }, { status: 401 })

	const senderId = new URL(req.url).searchParams.get('senderId')
	if (!senderId)
		return Response.json({ error: 'Missing senderId' }, { status: 400 })

	const senderKey = await prisma.senderKey.findUnique({
		where: {
			senderId_recipientId: {
				senderId,
				recipientId: session.user.id
			}
		},
		select: { encryptedKey: true }
	})

	return Response.json({ encryptedKey: senderKey?.encryptedKey ?? null })
}

/**
 * Сохраняет зашифрованный Sender Key для получателя.
 * encryptedKey зашифрован RSA публичным ключом recipientId.
 */
export async function POST(req: NextRequest) {
	const session = await auth()
	if (!session?.user?.id)
		return Response.json({ error: 'Unauthorized' }, { status: 401 })

	const body = await req.json()
	const { recipientId, encryptedKey } = body

	if (!recipientId || typeof recipientId !== 'string')
		return Response.json({ error: 'Invalid recipientId' }, { status: 400 })

	if (!encryptedKey || typeof encryptedKey !== 'string')
		return Response.json({ error: 'Invalid encryptedKey' }, { status: 400 })

	// Проверяем, что получатель существует
	const recipient = await prisma.user.findUnique({
		where: { id: recipientId },
		select: { id: true }
	})
	if (!recipient)
		return Response.json({ error: 'Recipient not found' }, { status: 404 })

	await prisma.senderKey.upsert({
		where: {
			senderId_recipientId: {
				senderId: session.user.id,
				recipientId
			}
		},
		create: {
			senderId: session.user.id,
			recipientId,
			encryptedKey
		},
		update: { encryptedKey }
	})

	return Response.json({ ok: true })
}
