"use client"

import { useEffect, useState } from "react"

interface Heart {
	id: number
	left: number
	size: number
	duration: number
	delay: number
	opacity: number
}

export function FloatingHearts() {
	const [hearts, setHearts] = useState<Heart[]>([])

	useEffect(() => {
		// Generate initial hearts
		const initialHearts: Heart[] = Array.from({ length: 15 }, (_, i) => ({
			id: i,
			left: Math.random() * 100,
			size: Math.random() * 20 + 12,
			duration: Math.random() * 10 + 15,
			delay: Math.random() * 10,
			opacity: Math.random() * 0.4 + 0.2,
		}))
		setHearts(initialHearts)
	}, [])

	return (
		<div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
			{hearts.map((heart) => (
				<div
					key={heart.id}
					className="absolute floating-heart"
					style={{
						left: `${heart.left}%`,
						fontSize: `${heart.size}px`,
						animationDuration: `${heart.duration}s`,
						animationDelay: `${heart.delay}s`,
						opacity: heart.opacity,
					}}>
					<HeartIcon />
				</div>
			))}
		</div>
	)
}

function HeartIcon() {
	const colors = [
		"hsl(var(--valentine-pink))",
		"hsl(var(--valentine-pink-light))",
		"hsl(var(--valentine-red))",
		"hsl(var(--valentine-rose))",
	]
	const color = colors[Math.floor(Math.random() * colors.length)]

	return (
		<svg viewBox="0 0 24 24" fill={color} className="w-[1em] h-[1em]">
			<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
		</svg>
	)
}
