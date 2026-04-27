"use client"

import Image from "next/image"
import { DM_Sans } from "next/font/google"
import { ArrowRight } from "lucide-react"

const dmSans = DM_Sans({
	subsets: ["latin"],
	weight: ["500", "700", "800"],
})

export function RoomoteAnnouncementBanner() {
	return (
		<div className={`relative overflow-hidden bg-[#d8f14b] text-black ${dmSans.className}`}>
			<div className="relative flex flex-col md:flex-row items-center justify-center gap-3 px-6 py-8 md:py-10 border-b-2 border-black">
				<p className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight">
					The Roo Code team has something new.
				</p>
				<a
					href="https://roomote.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-black text-white px-6 py-2.5 text-sm sm:text-base font-bold hover:bg-gray-900 transition-colors duration-200">
					Check out
					<Image
						src="/logos/roomote-logo.png"
						alt="Roomote"
						width={100}
						height={37}
						className="h-5 sm:h-6 w-auto invert"
					/>
					<ArrowRight className="size-4 sm:size-5 transition-transform duration-200 group-hover:translate-x-0.5" />
				</a>
			</div>
		</div>
	)
}
