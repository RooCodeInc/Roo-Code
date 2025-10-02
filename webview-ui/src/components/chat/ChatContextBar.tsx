import { useState, useMemo } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { MentionInfo } from "./lexical/LexicalMentionPlugin"

interface ContextItem {
	type: "mention" | "image"
	icon: string
	displayName: string
	originalIndex: number
	iconAlt: string
	iconStyle?: React.CSSProperties
	nodeKey?: string // Only for mention items
}

interface ChatContextBarProps {
	validMentions: MentionInfo[]
	selectedImages: string[]
	onRemoveMention: (index: number) => void
	onRemoveImage: (index: number) => void
}

export const ChatContextBar = ({
	validMentions,
	selectedImages,
	onRemoveMention,
	onRemoveImage,
}: ChatContextBarProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

	const contextItems = useMemo<ContextItem[]>(() => {
		const items: ContextItem[] = []

		validMentions.forEach((mention, index) => {
			let iconAlt = "File"
			if (mention.type === "folder") {
				iconAlt = "Folder"
			} else if (mention.type === "url") {
				iconAlt = "URL"
			} else if (mention.type === "problems") {
				iconAlt = "Problems"
			} else if (mention.type === "terminal") {
				iconAlt = "Terminal"
			} else if (mention.type === "git") {
				iconAlt = "Git"
			}

			items.push({
				type: "mention",
				icon: mention.icon,
				displayName: mention.displayName,
				originalIndex: index,
				iconAlt,
				nodeKey: mention.nodeKey,
			})
		})

		selectedImages.forEach((image, index) => {
			items.push({
				type: "image",
				icon: image,
				displayName: `Image #${index + 1}`,
				originalIndex: index,
				iconAlt: `Image ${index + 1}`,
				iconStyle: {
					objectFit: "cover",
					borderRadius: "2px",
				},
			})
		})

		return items
	}, [validMentions, selectedImages])

	const shouldShowContextBar = contextItems.length > 0

	if (!shouldShowContextBar) {
		return null
	}

	const handleRemove = (item: ContextItem) => {
		if (item.type === "mention") {
			onRemoveMention(item.originalIndex)
		} else {
			onRemoveImage(item.originalIndex)
		}
	}

	return (
		<div className="flex items-center flex-wrap gap-1 mb-2">
			{contextItems.map((item, index) => {
				// Use nodeKey for mentions, fallback to type-index for images
				const uniqueKey =
					item.type === "mention" && item.nodeKey
						? `mention-${item.nodeKey}`
						: `${item.type}-${item.originalIndex}`

				return (
					<div
						key={uniqueKey}
						className={cn(
							"relative flex items-center gap-1 px-2 py-1 border",
							"bg-vscode-input-background text-vscode-input-foreground",
							"rounded text-xs whitespace-nowrap flex-shrink-0 cursor-pointer",
							"hover:bg-vscode-list-hoverBackground",
						)}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}>
						{hoveredIndex === index ? (
							<button
								onClick={(e) => {
									e.stopPropagation()
									handleRemove(item)
									setHoveredIndex(null)
								}}
								className="flex shrink-0 items-center justify-center cursor-pointer">
								<X className="size-3 text-vscode-input-foreground" />
							</button>
						) : (
							<img
								src={item.icon}
								alt={item.iconAlt}
								className="size-3 shrink-0"
								style={{ ...item.iconStyle }}
							/>
						)}
						<span>{item.displayName}</span>
					</div>
				)
			})}
		</div>
	)
}
