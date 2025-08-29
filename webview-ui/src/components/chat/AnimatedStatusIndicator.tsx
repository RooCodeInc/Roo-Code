import React, { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@src/context/ExtensionStateContext"

interface AnimatedStatusIndicatorProps {
	isStreaming: boolean
	cost?: number | null
	cancelReason?: string | null
	apiRequestFailedMessage?: string
	streamingFailedMessage?: string
}

const DEFAULT_STATUS_TEXTS = ["Generating...", "Thinking...", "Working on it...", "Processing...", "Analyzing..."]

const DEFAULT_EMOJIS = [
	"🤔", // Thinking
	"🧠", // Brainstorming
	"⏳", // Loading
	"✨", // Magic
	"🔮", // Summoning
	"💭", // Thought bubble
	"⚡", // Lightning
	"🎯", // Target
]

export const AnimatedStatusIndicator: React.FC<AnimatedStatusIndicatorProps> = ({
	isStreaming,
	cost,
	cancelReason,
	apiRequestFailedMessage,
}) => {
	const { t } = useTranslation()
	const { apiStatusConfig = {} } = useExtensionState()

	// Configuration with defaults
	const config = useMemo(
		() => ({
			enabled: apiStatusConfig.enabled !== false,
			statusTexts:
				apiStatusConfig.customTexts && apiStatusConfig.customTexts.length > 0
					? apiStatusConfig.customTexts
					: DEFAULT_STATUS_TEXTS,
			emojisEnabled: apiStatusConfig.emojisEnabled === true,
			emojis:
				apiStatusConfig.customEmojis && apiStatusConfig.customEmojis.length > 0
					? apiStatusConfig.customEmojis
					: DEFAULT_EMOJIS,
			randomMode: apiStatusConfig.randomMode !== false,
			cycleInterval: apiStatusConfig.cycleInterval || 5000, // 5 seconds default
		}),
		[apiStatusConfig],
	)

	const [currentTextIndex, setCurrentTextIndex] = useState(0)
	const [currentEmojiIndex, setCurrentEmojiIndex] = useState(0)

	// Cycle through status texts and emojis
	useEffect(() => {
		if (!config.enabled || !isStreaming || !config.randomMode) return

		const interval = setInterval(() => {
			setCurrentTextIndex((prev) => (prev + 1) % config.statusTexts.length)

			if (config.emojisEnabled) {
				setCurrentEmojiIndex((prev) => (prev + 1) % config.emojis.length)
			}
		}, config.cycleInterval)

		return () => clearInterval(interval)
	}, [config, isStreaming])

	// Determine what text to show
	const statusText = useMemo(() => {
		if (cancelReason === "user_cancelled") {
			return t("chat:apiRequest.cancelled")
		}
		if (cancelReason) {
			return t("chat:apiRequest.streamingFailed")
		}
		if (cost !== null && cost !== undefined) {
			return t("chat:apiRequest.title")
		}
		if (apiRequestFailedMessage) {
			return t("chat:apiRequest.failed")
		}
		if (isStreaming && config.enabled) {
			return config.statusTexts[currentTextIndex]
		}
		return t("chat:apiRequest.streaming")
	}, [cancelReason, cost, apiRequestFailedMessage, isStreaming, config, currentTextIndex, t])

	// Don't show animated indicator if request is complete or failed
	if (!isStreaming || cost !== null || cancelReason || apiRequestFailedMessage) {
		return null
	}

	// If animation is disabled, return null (ChatRow will show default)
	if (!config.enabled) {
		return null
	}

	return (
		<div className="flex items-center gap-2">
			{config.emojisEnabled && (
				<span className="text-base animate-pulse-subtle">{config.emojis[currentEmojiIndex]}</span>
			)}
			<span
				className="text-vscode-foreground animate-pulse-subtle"
				style={{
					fontWeight: "bold",
					opacity: 0.9,
				}}>
				{statusText}
			</span>
		</div>
	)
}
