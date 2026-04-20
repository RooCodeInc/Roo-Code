"use client"

import { ArrowRight, Sparkles } from "lucide-react"

export function RoomoteAnnouncementBanner() {
	return (
		<div className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-purple-600 to-violet-700 text-white">
			{/* Animated shimmer overlay */}
			<div className="pointer-events-none absolute inset-0 bg-[length:200%_100%] animate-banner-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />

			<div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 py-3 sm:py-4">
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold uppercase tracking-wider">
						<Sparkles className="size-3.5" />
						New
					</span>
					<p className="text-sm sm:text-base font-medium">
						Introducing <span className="font-bold">Roomote</span> — AI-powered coding, now in Slack
					</p>
				</div>
				<a
					href="https://roomote.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="group inline-flex items-center gap-1.5 rounded-full bg-white text-violet-700 px-5 py-2 text-sm font-bold shadow-lg shadow-violet-900/30 hover:bg-violet-50 hover:shadow-violet-900/40 transition-all duration-300">
					Explore Roomote
					<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
				</a>
			</div>
		</div>
	)
}
