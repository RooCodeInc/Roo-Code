"use client"

import { Heart, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

export function ValentinesBanner() {
	const [isVisible, setIsVisible] = useState(true)

	// Check if we're in the Valentine's date range (Feb 1-15)
	useEffect(() => {
		const now = new Date()
		const month = now.getMonth() // 0-indexed, so February is 1
		const day = now.getDate()
		// Show banner from Feb 1-15
		const isValentinesSeason = month === 1 && day >= 1 && day <= 15
		setIsVisible(isValentinesSeason)
	}, [])

	if (!isVisible) return null

	return (
		<div className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 py-2.5 text-white">
			{/* Animated sparkles background */}
			<div className="absolute inset-0 overflow-hidden">
				{[...Array(6)].map((_, i) => (
					<Sparkles
						key={i}
						className="absolute animate-pulse text-white/30"
						style={{
							left: `${15 + i * 15}%`,
							top: `${20 + (i % 3) * 20}%`,
							animationDelay: `${i * 0.3}s`,
							transform: `scale(${0.6 + (i % 3) * 0.2})`,
						}}
					/>
				))}
			</div>

			<div className="container relative mx-auto flex items-center justify-center gap-3 px-4 text-center text-sm font-medium">
				<Heart className="size-4 animate-heartbeat fill-current" />
				<span>Happy Valentine&apos;s Day! Spread the love and build something amazing with Roo Code</span>
				<Heart className="size-4 animate-heartbeat fill-current" style={{ animationDelay: "0.5s" }} />
			</div>
		</div>
	)
}
