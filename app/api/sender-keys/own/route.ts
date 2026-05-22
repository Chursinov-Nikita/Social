import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

/** Получает self-backup Sender Key текущего пользователя */
export async function GET(_req: NextRequest) {
	const session = await auth()
	if (!session?.user?.id)
		return Response.json({ error: 'Unauthorized' }, { status: 401 })

	const senderKey = await prisma.senderKey.findUnique({
		where: {
			senderId_recipientId: {
				senderId: session.user.id,
				recipientId: session.user.id
			}
		},
		select: { encryptedKey: true }
	})

	return Response.json({ encryptedKey: senderKey?.encryptedKey ?? null })
}

/** Сохраняет self-backup Sender Key (зашифрован своим RSA) */
export async function POST(req: NextRequest) {
	const session = await auth()
	if (!session?.user?.id)
		return Response.json({ error: 'Unauthorized' }, { status: 401 })

	const body = await req.json()
	const { encryptedKey } = body

	if (!encryptedKey || typeof encryptedKey !== 'string')
		return Response.json({ error: 'Invalid encryptedKey' }, { status: 400 })

	await prisma.senderKey.upsert({
		where: {
			senderId_recipientId: {
				senderId: session.user.id,
				recipientId: session.user.id
			}
		},
		create: {
			senderId: session.user.id,
			recipientId: session.user.id,
			encryptedKey
		},
		update: { encryptedKey }
	})

	return Response.json({ ok: true })
}
