"use client"

import { useEffect, useState } from "react"
import { Heart } from "lucide-react"

interface FloatingHeart {
	id: number
	left: number
	delay: number
	duration: number
	size: number
}

export function ValentinesBanner() {
	const [hearts, setHearts] = useState<FloatingHeart[]>([])

	useEffect(() => {
		// Create floating hearts on mount
		const newHearts: FloatingHeart[] = Array.from({ length: 15 }, (_, i) => ({
			id: i,
			left: Math.random() * 100,
			delay: Math.random() * 5,
			duration: 3 + Math.random() * 4,
			size: 12 + Math.random() * 16,
		}))
		setHearts(newHearts)
	}, [])

	return (
		<div className="relative overflow-hidden bg-gradient-to-r from-pink-500/90 via-rose-500/90 to-red-500/90 py-3">
			{/* Floating hearts background */}
			<div className="absolute inset-0 pointer-events-none">
				{hearts.map((heart) => (
					<div
						key={heart.id}
						className="absolute animate-float-up opacity-60"
						style={{
							left: `${heart.left}%`,
							animationDelay: `${heart.delay}s`,
							animationDuration: `${heart.duration}s`,
						}}>
						<Heart
							className="text-white/40 fill-white/20"
							style={{ width: heart.size, height: heart.size }}
						/>
					</div>
				))}
			</div>

			{/* Banner content */}
			<div className="container mx-auto px-4 relative z-10">
				<div className="flex items-center justify-center gap-2 text-white font-medium">
					<Heart className="h-4 w-4 fill-white animate-pulse" />
					<span className="text-sm md:text-base">
						Happy Valentine&apos;s Day! Fall in love with AI-powered coding
					</span>
					<Heart className="h-4 w-4 fill-white animate-pulse" />
				</div>
			</div>
		</div>
	)
}
