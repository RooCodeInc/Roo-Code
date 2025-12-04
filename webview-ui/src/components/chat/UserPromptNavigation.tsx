import React, { useMemo, useCallback, useState, useEffect } from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { StandardTooltip } from "@src/components/ui"
import { LucideIconButton } from "./LucideIconButton"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ClineMessage } from "@roo-code/types"
import type { VirtuosoHandle } from "react-virtuoso"
import "./UserPromptNavigation.css"

interface UserPromptNavigationProps {
	messages: ClineMessage[]
	virtuosoRef: React.RefObject<VirtuosoHandle>
	visibleMessages: ClineMessage[]
	className?: string
}

export const UserPromptNavigation: React.FC<UserPromptNavigationProps> = ({
	messages,
	virtuosoRef,
	visibleMessages,
	className = "",
}) => {
	const { t } = useAppTranslation()
	const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(-1)
	const [isNavigating, setIsNavigating] = useState(false)

	// Find all user prompts in the visible messages
	const userPromptIndices = useMemo(() => {
		const indices: number[] = []
		visibleMessages.forEach((msg, index) => {
			if (msg.say === "user_feedback" && msg.text && msg.text.trim() !== "") {
				indices.push(index)
			}
		})
		return indices
	}, [visibleMessages])

	// Reset navigation when messages change significantly
	useEffect(() => {
		if (!isNavigating) {
			setCurrentPromptIndex(-1)
		}
	}, [messages.length, isNavigating])

	// Navigate to previous user prompt
	const navigateToPreviousPrompt = useCallback(() => {
		if (userPromptIndices.length === 0) return

		setIsNavigating(true)

		let targetIndex: number
		if (currentPromptIndex === -1) {
			// If not currently navigating, jump to the last prompt
			targetIndex = userPromptIndices.length - 1
		} else if (currentPromptIndex > 0) {
			// Navigate to previous prompt
			targetIndex = currentPromptIndex - 1
		} else {
			// Wrap around to the last prompt
			targetIndex = userPromptIndices.length - 1
		}

		setCurrentPromptIndex(targetIndex)
		const messageIndex = userPromptIndices[targetIndex]

		// Scroll to the message with smooth animation
		virtuosoRef.current?.scrollToIndex({
			index: messageIndex,
			behavior: "smooth",
			align: "center",
		})

		// Briefly highlight the message after scrolling
		setTimeout(() => {
			const element = document.querySelector(`[data-message-index="${messageIndex}"]`)
			if (element) {
				element.classList.add("prompt-highlight")
				setTimeout(() => {
					element.classList.remove("prompt-highlight")
				}, 1500)
			}
		}, 500)

		// Clear navigation state after a delay
		setTimeout(() => {
			setIsNavigating(false)
		}, 3000)
	}, [userPromptIndices, currentPromptIndex, virtuosoRef])

	// Navigate to next user prompt
	const navigateToNextPrompt = useCallback(() => {
		if (userPromptIndices.length === 0) return

		setIsNavigating(true)

		let targetIndex: number
		if (currentPromptIndex === -1) {
			// If not currently navigating, jump to the first prompt
			targetIndex = 0
		} else if (currentPromptIndex < userPromptIndices.length - 1) {
			// Navigate to next prompt
			targetIndex = currentPromptIndex + 1
		} else {
			// Wrap around to the first prompt
			targetIndex = 0
		}

		setCurrentPromptIndex(targetIndex)
		const messageIndex = userPromptIndices[targetIndex]

		// Scroll to the message with smooth animation
		virtuosoRef.current?.scrollToIndex({
			index: messageIndex,
			behavior: "smooth",
			align: "center",
		})

		// Briefly highlight the message after scrolling
		setTimeout(() => {
			const element = document.querySelector(`[data-message-index="${messageIndex}"]`)
			if (element) {
				element.classList.add("prompt-highlight")
				setTimeout(() => {
					element.classList.remove("prompt-highlight")
				}, 1500)
			}
		}, 500)

		// Clear navigation state after a delay
		setTimeout(() => {
			setIsNavigating(false)
		}, 3000)
	}, [userPromptIndices, currentPromptIndex, virtuosoRef])

	// Don't show navigation if there are no user prompts
	if (userPromptIndices.length === 0) {
		return null
	}

	const navigationInfo =
		currentPromptIndex !== -1
			? t("chat:promptNavigation.position", {
					current: currentPromptIndex + 1,
					total: userPromptIndices.length,
				})
			: t("chat:promptNavigation.total", { total: userPromptIndices.length })

	return (
		<div className={`flex items-center gap-1 ${className}`}>
			<StandardTooltip content={`${t("chat:promptNavigation.previousTooltip")} (Alt+↑)`}>
				<div data-prompt-nav="prev">
					<LucideIconButton
						icon={ChevronUp}
						onClick={navigateToPreviousPrompt}
						disabled={userPromptIndices.length === 0}
						className="h-7 w-7"
						title={t("chat:promptNavigation.previous")}
					/>
				</div>
			</StandardTooltip>

			{isNavigating && (
				<span className="text-xs text-vscode-descriptionForeground px-1 min-w-[60px] text-center">
					{navigationInfo}
				</span>
			)}

			<StandardTooltip content={`${t("chat:promptNavigation.nextTooltip")} (Alt+↓)`}>
				<div data-prompt-nav="next">
					<LucideIconButton
						icon={ChevronDown}
						onClick={navigateToNextPrompt}
						disabled={userPromptIndices.length === 0}
						className="h-7 w-7"
						title={t("chat:promptNavigation.next")}
					/>
				</div>
			</StandardTooltip>
		</div>
	)
}
