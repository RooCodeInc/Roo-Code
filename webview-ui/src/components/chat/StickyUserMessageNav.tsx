import React, { memo } from "react"
import { useTranslation } from "react-i18next"
import { ChevronUp, User } from "lucide-react"
import type { ClineMessage } from "@roo-code/types"
import { cn } from "@/lib/utils"

interface StickyUserMessageNavProps {
	/** The user message to display in the sticky nav */
	message: ClineMessage | null
	/** Callback when the sticky nav is clicked to scroll to the message */
	onNavigate: () => void
	/** Whether the sticky nav should be visible */
	isVisible: boolean
}

/**
 * A sticky navigation component that appears at the top of the chat when the user
 * scrolls up past their messages. Clicking it scrolls back to the most recent
 * user message that is out of view.
 */
const StickyUserMessageNav = memo(({ message, onNavigate, isVisible }: StickyUserMessageNavProps) => {
	const { t } = useTranslation()

	if (!isVisible || !message) {
		return null
	}

	// Truncate message text for display
	const displayText = message.text || ""
	const truncatedText = displayText.length > 80 ? displayText.substring(0, 80) + "..." : displayText

	return (
		<div
			className={cn(
				"sticky top-0 z-10 flex items-center gap-2 px-3 py-2 cursor-pointer",
				"bg-vscode-editor-background/95 backdrop-blur-sm",
				"border-b border-vscode-editorGroup-border",
				"transition-all duration-200 ease-in-out",
				"hover:bg-vscode-list-hoverBackground",
			)}
			onClick={onNavigate}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					onNavigate()
				}
			}}
			aria-label={t("chat:stickyNav.scrollToMessage")}>
			<ChevronUp className="w-4 h-4 text-vscode-descriptionForeground shrink-0" />
			<User className="w-4 h-4 text-vscode-descriptionForeground shrink-0" />
			<span className="text-sm text-vscode-foreground truncate flex-1">{truncatedText}</span>
			<span className="text-xs text-vscode-descriptionForeground shrink-0">
				{t("chat:stickyNav.clickToJump")}
			</span>
		</div>
	)
})

StickyUserMessageNav.displayName = "StickyUserMessageNav"

export default StickyUserMessageNav
