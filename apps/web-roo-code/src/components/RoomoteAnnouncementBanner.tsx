"use client"

import { ArrowRight } from "lucide-react"

export function RoomoteAnnouncementBanner() {
	return (
		<div className="relative overflow-hidden bg-[#c8f525] text-black">
			<div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 px-4 py-3.5 sm:py-4">
				<div className="flex items-center gap-3">
					<span className="inline-flex items-center rounded-full bg-black text-[#c8f525] px-3 py-1 text-xs font-bold uppercase tracking-wider">
						New
					</span>
					<p className="text-sm sm:text-base font-bold tracking-tight">
						Introducing Roomote — the always-on engineer for your entire team
					</p>
				</div>
				<a
					href="https://roomote.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="group inline-flex items-center gap-1.5 rounded-full bg-black text-white px-5 py-2 text-sm font-bold hover:bg-gray-900 transition-colors duration-200">
					Learn more
					<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
				</a>
			</div>
		</div>
	)
}
