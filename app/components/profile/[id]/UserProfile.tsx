'use client'

import { useLang } from '@/app/context/language'
import { t } from '@/app/translation/translation'
import { Props } from '@/app/types/profile'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const UserProfile = ({ user }: Props) => {
	const { lang } = useLang()
	const tr = t[lang]
	const router = useRouter()

	const initials = (user.name || user.email || '?')[0].toUpperCase()

	return (
		<div className="min-h-screen bg-(--bg-primary) text-(--text-primary) antialiased">
			<div className="mx-auto w-full max-w-2xl px-4 py-10">
				<button
					onClick={() => router.back()}
					className="flex items-center gap-2 text-sm text-(--text-primary)/40 hover:text-(--text-primary) transition-colors mb-6"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					{tr.back}
				</button>

				<div className="rounded-2xl border border-(--border) bg-(--bg-secondary) p-6 space-y-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--bg-card) text-xl font-semibold text-(--text-primary)/60 overflow-hidden">
							{user.image ? (
								<Image
									src={user.image}
									width={64}
									height={64}
									className="rounded-xl object-cover w-16 h-16"
									alt={user.name ?? ''}
								/>
							) : (
								initials
							)}
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-base font-semibold text-(--text-primary) truncate">
								{user.name || tr.noName}
							</p>
							<p className="text-xs text-(--text-primary)/30 truncate">
								{user.email}
							</p>
							<p className="text-xs text-(--text-primary)/20 mt-1">
								{lang === 'ru' ? 'С нами с' : 'Member since'}{' '}
								{new Date(user.createdAt).toLocaleDateString(lang, {
									month: 'long',
									year: 'numeric'
								})}
							</p>
						</div>
					</div>

					{/* Stats */}
					<div className="grid grid-cols-2 divide-x divide-(--border) rounded-xl border border-(--border)">
						{[
							{ value: user._count.reels, label: tr.reels },
							{ value: user._count.posts, label: tr.posts }
						].map(({ value, label }) => (
							<div
								key={label}
								className="p-3 text-center"
							>
								<p className="tabular-nums text-lg font-semibold text-(--text-primary)">
									{value}
								</p>
								<p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-(--text-primary)/30">
									{label}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

export default UserProfile
