"use client"

import { ArrowRight } from "lucide-react"

export function RoomoteAnnouncementBanner() {
	return (
		<div className="relative overflow-hidden bg-[#d8f14b] text-black">
			<div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-6 py-5 sm:py-6">
				<div className="flex items-center gap-3">
					<span className="inline-flex items-center rounded-full bg-black text-[#d8f14b] px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest">
						New
					</span>
					<p className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight">
						Introducing Roomote — the always-on engineer for your entire team
					</p>
				</div>
				<a
					href="https://roomote.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-black text-white px-6 py-2.5 text-sm sm:text-base font-bold hover:bg-gray-900 transition-colors duration-200">
					Learn more
					<ArrowRight className="size-4 sm:size-5 transition-transform duration-200 group-hover:translate-x-0.5" />
				</a>
			</div>
		</div>
	)
}
