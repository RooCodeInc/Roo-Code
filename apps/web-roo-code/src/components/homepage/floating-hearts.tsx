"use client"

import { useEffect, useState } from "react"

interface FloatingHeart {
	id: number
	left: number
	size: number
	duration: number
	delay: number
	opacity: number
}

export function FloatingHearts() {
	const [hearts, setHearts] = useState<FloatingHeart[]>([])
	const [isVisible, setIsVisible] = useState(true)

	useEffect(() => {
		// Check if we're in the Valentine's date range (Feb 1-15)
		const now = new Date()
		const month = now.getMonth() // 0-indexed, so February is 1
		const day = now.getDate()
		const isValentinesSeason = month === 1 && day >= 1 && day <= 15
		setIsVisible(isValentinesSeason)

		if (!isValentinesSeason) return

		// Generate random hearts
		const generatedHearts: FloatingHeart[] = Array.from({ length: 15 }, (_, i) => ({
			id: i,
			left: Math.random() * 100,
			size: 12 + Math.random() * 16,
			duration: 8 + Math.random() * 12,
			delay: Math.random() * 10,
			opacity: 0.1 + Math.random() * 0.2,
		}))
		setHearts(generatedHearts)
	}, [])

	if (!isVisible || hearts.length === 0) return null

	return (
		<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
			{hearts.map((heart) => (
				<div
					key={heart.id}
					className="absolute animate-float-up text-rose-500/50 dark:text-rose-400/30"
					style={{
						left: `${heart.left}%`,
						bottom: "-50px",
						fontSize: `${heart.size}px`,
						animationDuration: `${heart.duration}s`,
						animationDelay: `${heart.delay}s`,
						opacity: heart.opacity,
					}}>
					❤
				</div>
			))}
		</div>
	)
}
