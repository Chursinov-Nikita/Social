import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Проверяет, загружен ли SenderKey на сервер для данного получателя
export async function GET(req: NextRequest) {
	const session = await auth()
	if (!session?.user?.id)
		return Response.json({ error: 'Unauthorized' }, { status: 401 })

	const recipientId = new URL(req.url).searchParams.get('recipientId')
	if (!recipientId)
		return Response.json({ error: 'No recipientId' }, { status: 400 })

	const senderKey = await prisma.senderKey.findUnique({
		where: {
			senderId_recipientId: {
				senderId: session.user.id,
				recipientId
			}
		}
	})

	return Response.json({ uploaded: !!senderKey })
}
