'use client'

import { useLang } from '@/app/context/language'
import { useE2EE } from '@/app/hooks/useE2EE'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { t } from '@/app/translation/translation'
import type { ChatUser, Message } from '@/app/types/chat'
import { DeleteMode } from '@/app/types/chat'
import {
	EllipsisVertical,
	Loader2,
	MicIcon,
	Smile,
	Square,
	Trash2,
	UserCircle,
	XCircle
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react'

const PAGE_SIZE = 50

const EMOJI_CATEGORIES = [
	{
		label: 'Смайлы',
		emojis: [
			'😀',
			'😂',
			'🤣',
			'😊',
			'😍',
			'🥰',
			'😘',
			'😎',
			'🤩',
			'🥺',
			'😭',
			'😤',
			'😡',
			'🤯',
			'🥳',
			'😴',
			'🤔',
			'😶',
			'🤗',
			'😏',
			'😢',
			'😅',
			'🤦',
			'🙄',
			'😬',
			'🫡',
			'🫠',
			'🥹',
			'💀',
			'🤌'
		]
	},
	{
		label: 'Жесты',
		emojis: [
			'👍',
			'👎',
			'👏',
			'🙏',
			'💪',
			'🤝',
			'👋',
			'✌️',
			'🤞',
			'💅',
			'🫶',
			'🤙',
			'☝️',
			'🫵',
			'🖐️'
		]
	},
	{
		label: 'Сердца',
		emojis: [
			'❤️',
			'🔥',
			'✨',
			'🎉',
			'💯',
			'💔',
			'💕',
			'🌟',
			'⚡',
			'🎊',
			'🩷',
			'🧡',
			'💛',
			'💚',
			'💙',
			'💜',
			'🖤',
			'🤍'
		]
	},
	{
		label: 'Животные',
		emojis: [
			'🐶',
			'🐱',
			'🦊',
			'🐸',
			'🐼',
			'🦁',
			'🐯',
			'🦄',
			'🐨',
			'🐻',
			'🐺',
			'🐷',
			'🐮',
			'🐧',
			'🦋'
		]
	},
	{
		label: 'Еда',
		emojis: [
			'🍕',
			'🍔',
			'🍟',
			'🌮',
			'🍜',
			'🍣',
			'🎂',
			'🍩',
			'🍦',
			'☕',
			'🧋',
			'🍷',
			'🍺',
			'🍓',
			'🍉'
		]
	}
]

// Расширяем тип Message для поддержки аудио
type MessageWithType = Message & { type?: 'text' | 'audio' }

// Генерация волны — вне компонента, без Math.random и spread
function makeWaveBars(src: string, count: number): number[] {
	let seed = 1
	for (let j = 0; j < src.length; j++) {
		seed = (seed * 31 + src.charCodeAt(j)) | 0
	}
	const raw: number[] = []
	for (let i = 0; i < count; i++) {
		seed = (seed * 1664525 + 1013904223) & 0x7fffffff
		raw.push(seed / 0x7fffffff)
	}
	// Нормализация без spread — reduce вместо Math.min/max
	let min = raw[0] ?? 0
	let max = raw[0] ?? 1
	for (const v of raw) {
		if (v < min) min = v
		if (v > max) max = v
	}
	const range = max - min || 1
	// Сглаживание — каждый бар немного усредняется с соседями
	return raw.map((v, i) => {
		const prev = raw[i - 1] ?? v
		const next = raw[i + 1] ?? v
		const smooth = prev * 0.25 + v * 0.5 + next * 0.25
		return 0.15 + ((smooth - min) / range) * 0.85
	})
}

const WAVE_COUNT = 30

// Красивый плеер голосового сообщения
const AudioMessage = ({ src, isMe }: { src: string; isMe: boolean }) => {
	const audioRef = useRef<HTMLAudioElement>(null)
	// Все аудио-состояния в одном объекте — один setState вместо трёх
	const [state, setState] = useState({
		playing: false,
		progress: 0,
		duration: 0,
		currentTime: 0
	})

	const bars = useMemo(() => makeWaveBars(src, WAVE_COUNT), [src])

	const toggle = () => {
		const audio = audioRef.current
		if (!audio) return
		if (state.playing) audio.pause()
		else void audio.play()
	}

	const handleBarClick = (i: number) => {
		const audio = audioRef.current
		if (!audio || !state.duration) return
		audio.currentTime = (i / WAVE_COUNT) * state.duration
	}

	const formatSec = (s: number) => {
		const m = Math.floor(s / 60)
		const sec = Math.floor(s % 60)
			.toString()
			.padStart(2, '0')
		return `${m}:${sec}`
	}

	const accent = isMe ? 'bg-white/60' : 'bg-(--text-primary)/25'
	const accentActive = isMe ? 'bg-white' : 'bg-(--text-primary)/80'
	const btnBg = isMe
		? 'bg-white/20 hover:bg-white/30'
		: 'bg-(--text-primary)/10 hover:bg-(--text-primary)/20'
	const timeColor = isMe ? 'text-white/40' : 'text-(--text-primary)/30'

	const filledBars = Math.round(state.progress * WAVE_COUNT)

	return (
		<div className="flex items-center gap-2.5 w-[220px]">
			<audio
				ref={audioRef}
				src={src}
				onPlay={() => setState(s => ({ ...s, playing: true }))}
				onPause={() => setState(s => ({ ...s, playing: false }))}
				onEnded={() =>
					setState({
						playing: false,
						progress: 0,
						duration: state.duration,
						currentTime: 0
					})
				}
				onLoadedMetadata={e =>
					setState(s => ({
						...s,
						duration: (e.target as HTMLAudioElement).duration
					}))
				}
				onTimeUpdate={e => {
					const audio = e.target as HTMLAudioElement
					setState(s => ({
						...s,
						currentTime: audio.currentTime,
						progress: audio.duration ? audio.currentTime / audio.duration : 0
					}))
				}}
			/>

			{/* Play/Pause */}
			<button
				onClick={toggle}
				className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${btnBg}`}
			>
				{state.playing ? (
					<svg
						viewBox="0 0 24 24"
						className="w-4 h-4 fill-current"
					>
						<rect
							x="5"
							y="4"
							width="4"
							height="16"
							rx="1"
						/>
						<rect
							x="15"
							y="4"
							width="4"
							height="16"
							rx="1"
						/>
					</svg>
				) : (
					<svg
						viewBox="0 0 24 24"
						className="w-4 h-4 fill-current ml-0.5"
					>
						<path d="M8 5.14v14l11-7-11-7z" />
					</svg>
				)}
			</button>

			{/* Волна + время */}
			<div className="flex-1 flex flex-col gap-1.5">
				<div className="flex items-end gap-[2px] h-7">
					{bars.map((h, i) => (
						<button
							key={i}
							onClick={() => handleBarClick(i)}
							style={{ height: `${Math.round(h * 100)}%` }}
							className={`flex-1 rounded-full transition-colors cursor-pointer ${i < filledBars ? accentActive : accent}`}
						/>
					))}
				</div>
				<span className={`text-[10px] tabular-nums ${timeColor}`}>
					{state.playing || state.currentTime > 0
						? formatSec(state.currentTime)
						: formatSec(state.duration)}
				</span>
			</div>
		</div>
	)
}

const ChatWindow = ({
	recipient,
	onChatDeleted
}: {
	recipient: ChatUser
	onChatDeleted?: () => void
}) => {
	const { data: session } = useSession()
	const { lang } = useLang()
	const tr = t[lang]
	const currentUserId = session?.user?.id

	const [messages, setMessages] = useState<MessageWithType[]>([])
	const [decryptedMessages, setDecryptedMessages] = useState<MessageWithType[]>(
		[]
	)
	const [content, setContent] = useState('')
	const [hasMore, setHasMore] = useState(true)
	const [loadingOlder, setLoadingOlder] = useState(false)
	const [showMenu, setShowMenu] = useState(false)
	const [showEmoji, setShowEmoji] = useState(false)
	const [deleteMode, setDeleteMode] = useState<DeleteMode>(null)
	const [deleting, setDeleting] = useState(false)
	const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
	const [pendingDeleteMsgId, setPendingDeleteMsgId] = useState<string | null>(
		null
	)
	const [deletingMsg, setDeletingMsg] = useState(false)
	const [isRecording, setIsRecording] = useState(false)
	const [recordingTime, setRecordingTime] = useState(0)
	const [activeCat, setActiveCat] = useState(0)

	const containerRef = useRef<HTMLDivElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const emojiRef = useRef<HTMLDivElement>(null)
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const audioChunksRef = useRef<Blob[]>([])
	const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const router = useRouter()

	const { onlineUsers, lastSeen } = useOnlineStatus([recipient.id])
	const isOnline = onlineUsers.has(recipient.id)
	const { ready, encrypt, decrypt } = useE2EE(recipient.id)

	// Fix 1: startTransition убирает warning о синхронных setState в эффекте
	useEffect(() => {
		if (!currentUserId) return
		startTransition(() => {
			setMessages([])
			setDecryptedMessages([])
			setHasMore(true)
		})

		fetch(`/api/chat/messages?recipientId=${recipient.id}`)
			.then(r => r.json())
			.then((data: MessageWithType[]) => {
				setMessages(data)
				setHasMore(data.length === PAGE_SIZE)
			})

		fetch('/api/chat/messages/read', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ senderId: recipient.id })
		})
	}, [recipient.id, currentUserId])

	useEffect(() => {
		if (!currentUserId) return
		const interval = setInterval(async () => {
			const res = await fetch(`/api/chat/messages?recipientId=${recipient.id}`)
			const data: MessageWithType[] = await res.json()
			setMessages(data)
		}, 5000)
		return () => clearInterval(interval)
	}, [recipient.id, currentUserId])

	const decryptAll = useCallback(
		async (msgs: MessageWithType[]) => {
			if (!msgs.length) {
				setDecryptedMessages([])
				return
			}
			const result = await Promise.all(
				msgs.map(async msg => {
					const decrypted = await decrypt(msg.content, msg.senderId)
					// Определяем аудио по содержимому — data URL или blob URL
					const isAudio =
						msg.type === 'audio' ||
						decrypted.startsWith('data:audio/') ||
						decrypted.startsWith('blob:')
					if (isAudio && decrypted.startsWith('data:audio/')) {
						try {
							const res = await fetch(decrypted)
							const blob = await res.blob()
							return {
								...msg,
								type: 'audio' as const,
								content: URL.createObjectURL(blob)
							}
						} catch {
							return { ...msg, type: 'audio' as const, content: decrypted }
						}
					}
					return {
						...msg,
						...(isAudio && { type: 'audio' as const }),
						content: decrypted
					}
				})
			)
			setDecryptedMessages(result)
		},
		[decrypt]
	)

	// Fix 2: async IIFE вместо void decryptAll(...)
	useEffect(() => {
		;(async () => {
			await decryptAll(messages)
		})()
	}, [messages, decryptAll])

	useEffect(() => {
		const c = containerRef.current
		if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
	}, [decryptedMessages])

	// Закрываем меню при клике вне
	useEffect(() => {
		if (!showMenu) return
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setShowMenu(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [showMenu])

	// Enter во время записи — остановить и отправить
	useEffect(() => {
		if (!isRecording) return
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault()
				stopRecording()
			}
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [isRecording])

	// Закрываем emoji-пикер при клике вне
	useEffect(() => {
		if (!showEmoji) return
		const handler = (e: MouseEvent) => {
			if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
				setShowEmoji(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [showEmoji])

	const loadOlder = async () => {
		if (!messages.length || loadingOlder || !hasMore) return
		setLoadingOlder(true)
		const cursor = messages[0].createdAt
		const res = await fetch(
			`/api/chat/messages?recipientId=${recipient.id}&cursor=${cursor}`
		)
		const older: MessageWithType[] = await res.json()
		setMessages(prev => [...older, ...prev])
		setHasMore(older.length === PAGE_SIZE)
		setLoadingOlder(false)
	}

	const sendMessage = async () => {
		if (!content.trim() || !currentUserId) return
		const plainText = content.trim()
		setContent('')

		const encryptedContent = ready
			? ((await encrypt(plainText)) ?? plainText)
			: plainText

		const optimistic: MessageWithType = {
			id: crypto.randomUUID(),
			senderId: currentUserId,
			receiverId: recipient.id,
			content: plainText,
			type: 'text',
			read: false,
			createdAt: new Date().toISOString()
		}
		setDecryptedMessages(prev => [...prev, optimistic])

		try {
			const res = await fetch('/api/chat/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					receiverId: recipient.id,
					content: encryptedContent
				})
			})
			const saved: MessageWithType = await res.json()
			setDecryptedMessages(prev =>
				prev.map(m =>
					m.id === optimistic.id ? { ...saved, content: plainText } : m
				)
			)
		} catch {
			setDecryptedMessages(prev => prev.filter(m => m.id !== optimistic.id))
			setContent(plainText)
		}
	}

	// --- Голосовые сообщения ---

	const formatRecordingTime = (sec: number) => {
		const m = Math.floor(sec / 60)
			.toString()
			.padStart(2, '0')
		const s = (sec % 60).toString().padStart(2, '0')
		return `${m}:${s}`
	}

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const recorder = new MediaRecorder(stream)
			audioChunksRef.current = []

			recorder.ondataavailable = e => {
				if (e.data.size > 0) audioChunksRef.current.push(e.data)
			}

			recorder.onstop = async () => {
				stream.getTracks().forEach(t => t.stop())
				const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
				await sendAudioMessage(blob)
			}

			recorder.start()
			mediaRecorderRef.current = recorder
			setIsRecording(true)
			setRecordingTime(0)

			let sec = 0
			recordingTimerRef.current = setInterval(() => {
				sec++
				setRecordingTime(sec)
				if (sec >= 120) stopRecording()
			}, 1000)
		} catch {
			// Нет доступа к микрофону
		}
	}

	const stopRecording = () => {
		if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
		mediaRecorderRef.current?.stop()
		setIsRecording(false)
		setRecordingTime(0)
	}

	const cancelRecording = () => {
		if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
		if (mediaRecorderRef.current) {
			// Убираем onstop, чтобы запись не отправилась
			mediaRecorderRef.current.onstop = null
			mediaRecorderRef.current.stop()
		}
		setIsRecording(false)
		setRecordingTime(0)
	}

	const sendAudioMessage = async (blob: Blob) => {
		if (!currentUserId) return

		// Конвертируем blob → base64 data URL
		const base64 = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(reader.result as string)
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})

		// Оптимистичное сообщение — показываем сразу через blob URL
		const tempUrl = URL.createObjectURL(blob)
		const optimistic: MessageWithType = {
			id: crypto.randomUUID(),
			senderId: currentUserId,
			receiverId: recipient.id,
			content: tempUrl,
			type: 'audio',
			read: false,
			createdAt: new Date().toISOString()
		}
		setDecryptedMessages(prev => [...prev, optimistic])

		try {
			// Шифруем base64-строку так же, как текст
			const encryptedContent = ready
				? ((await encrypt(base64)) ?? base64)
				: base64

			const res = await fetch('/api/chat/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					receiverId: recipient.id,
					content: encryptedContent,
					type: 'audio'
				})
			})
			const saved: MessageWithType = await res.json()
			// Подменяем на tempUrl — так аудио воспроизводится без повторного декодирования
			setDecryptedMessages(prev =>
				prev.map(m =>
					m.id === optimistic.id
						? { ...saved, content: tempUrl, type: 'audio' as const }
						: m
				)
			)
		} catch {
			URL.revokeObjectURL(tempUrl)
			setDecryptedMessages(prev => prev.filter(m => m.id !== optimistic.id))
		}
	}

	// --- Удаление ---

	const confirmDeleteMessage = async () => {
		if (!pendingDeleteMsgId) return
		setDeletingMsg(true)
		await fetch(`/api/chat/messages/${pendingDeleteMsgId}`, {
			method: 'DELETE'
		})
		setDecryptedMessages(prev => prev.filter(m => m.id !== pendingDeleteMsgId))
		setMessages(prev => prev.filter(m => m.id !== pendingDeleteMsgId))
		setPendingDeleteMsgId(null)
		setDeletingMsg(false)
	}

	const confirmDelete = async () => {
		if (!deleteMode || !currentUserId) return
		setDeleting(true)

		if (deleteMode === 'chat') {
			await fetch('/api/chat/clear', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ recipientId: recipient.id, mode: 'all' })
			})
			setDeleteMode(null)
			setDeleting(false)
			onChatDeleted?.()
			return
		}

		await fetch('/api/chat/clear', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ recipientId: recipient.id, mode: deleteMode })
		})

		setMessages([])
		setDecryptedMessages([])
		setDeleteMode(null)
		setDeleting(false)
	}

	const formatLastSeen = (dateStr: string) => {
		const date = new Date(dateStr)
		const now = new Date()
		const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)

		if (diffMin < 1) return tr.wasOnlineNow
		if (diffMin < 60) return tr.wasOnlineMins(diffMin)

		const timeStr = date.toLocaleTimeString(lang, {
			hour: '2-digit',
			minute: '2-digit'
		})

		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		const yesterday = new Date(today)
		yesterday.setDate(today.getDate() - 1)
		const dateOnly = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate()
		)

		if (dateOnly.getTime() === today.getTime())
			return tr.wasOnlineToday(timeStr)
		if (dateOnly.getTime() === yesterday.getTime())
			return tr.wasOnlineYesterday(timeStr)

		const dateFormatted = date.toLocaleDateString(lang, {
			day: 'numeric',
			month: 'long'
		})
		return tr.wasOnlineDate(dateFormatted, timeStr)
	}

	const statusText = isOnline
		? 'в сети'
		: lastSeen[recipient.id]
			? formatLastSeen(lastSeen[recipient.id])
			: tr.online

	const deleteModalText: Record<
		NonNullable<DeleteMode>,
		{ title: string; desc: string }
	> = {
		mine: { title: tr.deleteMyMessages, desc: tr.deleteMineDesc },
		all: { title: tr.deleteAllMessages, desc: tr.deleteAllDesc },
		chat: { title: tr.deleteChat, desc: tr.deleteChatDesc }
	}

	return (
		<div className="flex flex-col h-full overflow-hidden bg-(--bg-primary)">
			{/* Header */}
			<div className="flex items-center gap-4 px-5 py-4 border-b border-(--border) bg-(--bg-primary)">
				<div className="relative shrink-0">
					<div
						className="w-10 h-10 rounded-full bg-(--bg-card) flex items-center justify-center text-sm font-bold text-(--text-primary) cursor-pointer"
						onClick={() => router.push(`/components/profile/${recipient.id}`)}
					>
						{recipient.image ? (
							<Image
								src={recipient.image}
								width={40}
								height={40}
								className="rounded-full object-cover w-10 h-10"
								alt={recipient.name ?? ''}
							/>
						) : (
							(recipient.name ?? '?')[0].toUpperCase()
						)}
					</div>
					{isOnline && (
						<span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-(--bg-secondary) rounded-full" />
					)}
				</div>

				<div className="flex-1">
					<p
						className="text-sm font-semibold text-(--text-primary) cursor-pointer"
						onClick={() => router.push(`/components/profile/${recipient.id}`)}
					>
						{recipient.name}
					</p>
					<p
						className={`text-xs transition-colors ${isOnline ? 'text-green-500' : 'text-(--text-primary)/30'}`}
					>
						{statusText}
					</p>
				</div>

				{/* Меню */}
				<div
					className="relative"
					ref={menuRef}
				>
					<button
						onClick={() => setShowMenu(p => !p)}
						className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-colors"
					>
						<EllipsisVertical className="w-4.5 h-4.5" />
					</button>

					{showMenu && (
						<div className="absolute right-0 top-18 z-30 bg-(--bg-secondary) border border-(--border) rounded-xl p-1 shadow-xl min-w-48">
							<button
								className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
								onClick={() => {
									router.push(`/components/profile/${recipient.id}`)
									setShowMenu(false)
								}}
							>
								<UserCircle className="w-4 h-4" />
								{tr.goToProfile}
							</button>
							<button
								onClick={() => {
									setDeleteMode('mine')
									setShowMenu(false)
								}}
								className="w-full flex items-center gap-2 px-3 py-2 text-xs text-(--text-primary)/70 hover:bg-(--bg-card) rounded-lg transition-colors text-left"
							>
								<Trash2 className="w-3.5 h-3.5" />
								{deleteModalText.mine.title}
							</button>
							<button
								onClick={() => {
									setDeleteMode('all')
									setShowMenu(false)
								}}
								className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
							>
								<Trash2 className="w-3.5 h-3.5" />
								{deleteModalText.all.title}
							</button>
							<div className="h-px bg-(--border) my-1" />
							<button
								onClick={() => {
									setDeleteMode('chat')
									setShowMenu(false)
								}}
								className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-left font-medium"
							>
								<XCircle className="w-4 h-4" />
								{deleteModalText.chat.title}
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Messages */}
			<div
				ref={containerRef}
				className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
			>
				{hasMore && (
					<div className="flex justify-center pb-3">
						<button
							onClick={loadOlder}
							disabled={loadingOlder}
							className="text-xs px-3 py-1.5 rounded-full bg-(--bg-secondary) text-(--text-primary)/80 hover:bg-(--bg-card) disabled:opacity-40 transition-colors"
						>
							{loadingOlder ? tr.loading : tr.loadOlderMessages}
						</button>
					</div>
				)}

				{decryptedMessages.map(msg => {
					const isMe = msg.senderId === currentUserId
					const isAudio = msg.type === 'audio'

					return (
						<div
							key={msg.id}
							className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/msg`}
							onMouseEnter={() => setHoveredMsg(msg.id)}
							onMouseLeave={() => setHoveredMsg(null)}
						>
							<div className="flex items-end gap-1">
								{isMe && hoveredMsg === msg.id && (
									<button
										onClick={() => setPendingDeleteMsgId(msg.id)}
										className="w-6 h-6 rounded-full bg-(--bg-secondary) flex items-center justify-center text-(--text-primary)/30 hover:text-red-400 transition-colors mb-1 shrink-0"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								)}
								<div
									className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed text-(--text-primary) ${isAudio ? '' : 'max-w-xs'} ${isMe ? 'bg-(--bg-card) rounded-br-sm' : 'bg-(--bg-secondary) rounded-bl-sm'}`}
								>
									{isAudio ? (
										<AudioMessage
											src={msg.content}
											isMe={isMe}
										/>
									) : (
										<p>{msg.content}</p>
									)}
									<p className="text-[10px] mt-1 text-right text-(--text-primary)/30">
										{new Date(msg.createdAt).toLocaleTimeString(lang, {
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			{/* Input */}
			<div className="py-5 px-3">
				{isRecording ? (
					// Режим записи голоса
					<div className="flex items-center gap-3 bg-(--bg-secondary) rounded-full px-4 py-2.5">
						<span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
						<span className="text-sm text-(--text-primary) flex-1 tabular-nums">
							{formatRecordingTime(recordingTime)}
						</span>
						<button
							onClick={cancelRecording}
							className="text-(--text-primary)/40 hover:text-red-400 transition-colors p-1"
							title="Отмена"
						>
							<XCircle className="w-5 h-5" />
						</button>
						<button
							onClick={stopRecording}
							className="bg-red-500 hover:bg-red-600 rounded-full p-1.5 transition-colors"
							title="Отправить"
						>
							<Square className="w-3.5 h-3.5 fill-white text-white" />
						</button>
					</div>
				) : (
					<div className="flex items-end gap-1">
						{/* Emoji picker */}
						<div
							ref={emojiRef}
							className="relative"
						>
							<button
								onClick={() => setShowEmoji(p => !p)}
								className="bg-(--bg-secondary) rounded-full p-2.5 transition-colors hover:bg-(--bg-card)"
							>
								<Smile className="w-6 h-6 text-(--text-primary)/85" />
							</button>

							{showEmoji && (
								<div className="absolute bottom-14 left-0 z-30 bg-(--bg-secondary) border border-(--border) rounded-2xl shadow-2xl w-72 overflow-hidden">
									{/* Табы категорий */}
									<div className="flex border-b border-(--border)">
										{EMOJI_CATEGORIES.map((cat, i) => (
											<button
												key={cat.label}
												onClick={() => setActiveCat(i)}
												className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
													activeCat === i
														? 'text-(--text-primary) border-b-2 border-(--text-primary) -mb-px'
														: 'text-(--text-primary)/40 hover:text-(--text-primary)/70'
												}`}
											>
												{cat.emojis[0]}
											</button>
										))}
									</div>
									{/* Название категории */}
									<p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-(--text-primary)/30">
										{EMOJI_CATEGORIES[activeCat].label}
									</p>
									{/* Эмодзи */}
									<div className="grid grid-cols-8 gap-px px-2 pb-2">
										{EMOJI_CATEGORIES[activeCat].emojis.map(emoji => (
											<button
												key={emoji}
												onClick={() => {
													setContent(prev => prev + emoji)
													setShowEmoji(false)
												}}
												className="aspect-square flex items-center justify-center text-2xl hover:bg-(--bg-card) rounded-xl transition-colors"
											>
												{emoji}
											</button>
										))}
									</div>
								</div>
							)}
						</div>

						<textarea
							value={content}
							onChange={e => setContent(e.target.value)}
							onKeyDown={e => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault()
									if (isRecording) stopRecording()
									else void sendMessage()
								}
							}}
							placeholder={tr.writeMessage}
							rows={1}
							className="flex-1 bg-(--bg-secondary) rounded-full px-4.5 py-2.5 text-md text-(--text-primary) placeholder:text-(--text-primary)/90 resize-none focus:outline-none transition-colors"
						/>

						<button
							onClick={startRecording}
							className="bg-(--bg-secondary) rounded-full p-2.5 transition-colors hover:bg-(--bg-card)"
						>
							<MicIcon className="w-6 h-6 text-(--text-primary)/85" />
						</button>
					</div>
				)}
			</div>

			{/* Модалка удаления одного сообщения */}
			{pendingDeleteMsgId && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
					onClick={() => !deletingMsg && setPendingDeleteMsgId(null)}
				>
					<div
						className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl"
						onClick={e => e.stopPropagation()}
					>
						<h2 className="text-base font-semibold text-(--text-primary)">
							{tr.deleteThisMessage}
						</h2>
						<p className="mt-2 text-sm text-(--text-primary)/60">
							{tr.deleteThisMessageDesc}
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								onClick={() => setPendingDeleteMsgId(null)}
								disabled={deletingMsg}
								className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors disabled:opacity-40"
							>
								{tr.cancel}
							</button>
							<button
								onClick={confirmDeleteMessage}
								disabled={deletingMsg}
								className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{deletingMsg ? (
									<>
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
										{tr.deleting}
									</>
								) : (
									tr.delete
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Модалка массового удаления */}
			{deleteMode && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
					onClick={() => !deleting && setDeleteMode(null)}
				>
					<div
						className="w-full max-w-md rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 shadow-2xl"
						onClick={e => e.stopPropagation()}
					>
						<h2 className="text-base font-semibold text-(--text-primary)">
							{deleteModalText[deleteMode].title}
						</h2>
						<p className="mt-2 text-sm text-(--text-primary)/60">
							{deleteModalText[deleteMode].desc}
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<button
								onClick={() => setDeleteMode(null)}
								disabled={deleting}
								className="px-3 py-1.5 rounded-lg text-sm text-(--text-primary)/60 hover:bg-(--bg-card) transition-colors disabled:opacity-40"
							>
								{tr.cancel}
							</button>
							<button
								onClick={confirmDelete}
								disabled={deleting}
								className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{deleting ? (
									<>
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
										{tr.deleting}
									</>
								) : (
									tr.delete
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default ChatWindow
