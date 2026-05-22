import React, { useState, useCallback } from "react"
import { Popover, PopoverContent, PopoverTrigger, Button } from "@src/components/ui"

/**
 * Curated emoji list organized by category for personality traits.
 */
const EMOJI_LIST = [
	// Faces & Expressions
	"😊", "😎", "🤓", "😤", "😈", "🥳", "🤔", "😏", "🧐", "😴",
	"🤪", "😇", "🥶", "🤩", "😬", "🫡", "🤖", "👻", "💀", "🤠",
	// Animals & Nature
	"🦘", "🐉", "🦊", "🐺", "🦁", "🐙", "🦄", "🐝", "🦅", "🐸",
	// Objects & Symbols
	"🎭", "🎯", "🧠", "🎪", "🕶️", "🎨", "☕", "🔍", "⚡", "🏴‍☠️",
	"🔥", "💎", "🎸", "🎲", "🧪", "📚", "🛡️", "⚔️", "🪄", "🌟",
	// Misc Fun
	"🚀", "💡", "🎬", "🌈", "🍕", "🌶️", "🧊", "🫠", "✨", "💫",
]

interface EmojiPickerProps {
	value: string
	onChange: (emoji: string) => void
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ value, onChange }) => {
	const [open, setOpen] = useState(false)

	const handleSelect = useCallback(
		(emoji: string) => {
			onChange(emoji)
			setOpen(false)
		},
		[onChange],
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="secondary"
					className="w-14 h-9 text-lg p-0 flex items-center justify-center"
					title="Pick an emoji">
					{value || "😊"}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[280px] p-2" align="start">
				<div className="grid grid-cols-10 gap-0.5">
					{EMOJI_LIST.map((emoji) => (
						<button
							key={emoji}
							onClick={() => handleSelect(emoji)}
							className={`w-7 h-7 flex items-center justify-center rounded text-base cursor-pointer transition-colors
								${value === emoji ? "bg-vscode-button-background" : "hover:bg-vscode-list-hoverBackground"}
							`}
							title={emoji}>
							{emoji}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default EmojiPicker
