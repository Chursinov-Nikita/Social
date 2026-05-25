export type Message = {
	id: string
	senderId: string
	receiverId: string
	content: string
	read: boolean
	createdAt: string
}

export type ChatUser = {
	id: string
	name: string | null
	image: string | null
}

export type MessagePreview = {
	content: string
	createdAt: string
	senderId: string
	receiverId: string
	read: boolean
}

export type Folder = {
	id: string
	name: string
	members: { companionId: string }[]
}

export type Props = {
	onSelect: (user: ChatUser) => void
	selected: ChatUser | null
}

export type DeleteMode = 'mine' | 'all' | 'chat' | null

export type MessageWithType = Message & { type?: 'text' | 'audio' }

//other
export const PAGE_SIZE = 50
