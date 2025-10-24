import React, { useEffect, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@src/lib/utils"

interface KangarooEasterEggProps {
	onClose: () => void
}

const kangarooJokes = [
	{
		setup: "Why don't kangaroos make good dancers?",
		punchline: "Because they have two left feet!",
	},
	{
		setup: "What do you call a lazy kangaroo?",
		punchline: "A pouch potato!",
	},
	{
		setup: "What's a kangaroo's favorite year?",
		punchline: "Leap year!",
	},
	{
		setup: "Why did the kangaroo stop drinking coffee?",
		punchline: "It made him too jumpy!",
	},
	{
		setup: "What do you call a kangaroo at the North Pole?",
		punchline: "Lost!",
	},
]

export const KangarooEasterEgg: React.FC<KangarooEasterEggProps> = ({ onClose }) => {
	const [joke] = useState(() => kangarooJokes[Math.floor(Math.random() * kangarooJokes.length)])
	const [showPunchline, setShowPunchline] = useState(false)

	useEffect(() => {
		const timer = setTimeout(() => setShowPunchline(true), 1500)
		return () => clearTimeout(timer)
	}, [])

	return (
		<div
			className={cn(
				"fixed inset-0 z-[9999] flex items-center justify-center",
				"bg-black/50 backdrop-blur-sm",
				"animate-in fade-in duration-300",
			)}
			onClick={onClose}>
			<div
				className={cn(
					"relative max-w-md mx-4 p-6 rounded-lg",
					"bg-vscode-editor-background border border-vscode-widget-border",
					"shadow-2xl animate-in zoom-in-95 duration-300",
				)}
				onClick={(e) => e.stopPropagation()}>
				<button
					onClick={onClose}
					className={cn(
						"absolute top-2 right-2 p-1 rounded",
						"text-vscode-descriptionForeground hover:text-vscode-foreground",
						"hover:bg-vscode-toolbar-hoverBackground",
						"transition-colors",
					)}
					aria-label="Close">
					<X className="w-4 h-4" />
				</button>

				<div className="text-center">
					<div className="text-6xl mb-4 animate-bounce">🦘</div>
					<div className="space-y-4">
						<p className="text-lg text-vscode-foreground font-medium">{joke.setup}</p>
						{showPunchline && (
							<p
								className={cn(
									"text-base text-vscode-descriptionForeground italic",
									"animate-in fade-in slide-in-from-bottom-2 duration-500",
								)}>
								{joke.punchline}
							</p>
						)}
					</div>
					<p className="text-xs text-vscode-descriptionForeground mt-6 opacity-60">
						You found the Roo Code Easter egg!
					</p>
				</div>
			</div>
		</div>
	)
}
