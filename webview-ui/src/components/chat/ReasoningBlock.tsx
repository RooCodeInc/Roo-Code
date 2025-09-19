import React, { memo, useEffect, useRef, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import debounce from "debounce"

import MarkdownBlock from "../common/MarkdownBlock"
import { Clock, Lightbulb } from "lucide-react"

interface ReasoningBlockProps {
	content: string
	ts: number
	isStreaming: boolean
	isLast: boolean
	metadata?: any
}

interface ElapsedTimeProps {
	isActive: boolean
	startTime: number
}

/**
 * Memoized timer component that only re-renders itself
 * This prevents the entire ReasoningBlock from re-rendering every second
 */
const ElapsedTime = memo(({ isActive, startTime }: ElapsedTimeProps) => {
	const { t } = useTranslation()
	const [elapsed, setElapsed] = useState<number>(0)

	useEffect(() => {
		if (isActive) {
			const tick = () => setElapsed(Date.now() - startTime)
			tick() // Initial tick
			const id = setInterval(tick, 1000)
			return () => clearInterval(id)
		} else {
			setElapsed(0)
		}
	}, [isActive, startTime])

	if (elapsed === 0) return null

	const seconds = Math.floor(elapsed / 1000)
	const secondsLabel = t("chat:reasoning.seconds", { count: seconds })

	return (
		<span className="text-vscode-foreground tabular-nums flex items-center gap-1">
			<Clock className="w-4" />
			{secondsLabel}
		</span>
	)
})

ElapsedTime.displayName = "ElapsedTime"

/**
 * Render reasoning with a heading and a simple timer.
 * - Heading uses i18n key chat:reasoning.thinking
 * - Timer runs while reasoning is active (no persistence)
 * - Timer is isolated in a memoized component to prevent full re-renders
 * - Content updates are debounced to prevent excessive re-renders during streaming
 */
export const ReasoningBlock = ({ content, isStreaming, isLast }: ReasoningBlockProps) => {
	const { t } = useTranslation()
	const startTimeRef = useRef<number>(Date.now())
	const [debouncedContent, setDebouncedContent] = useState<string>(content || "")

	// Create a debounced function to update content
	// This limits content updates to a maximum of ~10 per second (100ms debounce)
	const updateDebouncedContent = useMemo(
		() =>
			debounce((newContent: string) => {
				setDebouncedContent(newContent)
			}, 100),
		[],
	)

	// Update debounced content when content changes
	useEffect(() => {
		if (isStreaming) {
			// During streaming, use debounced updates
			updateDebouncedContent(content || "")
		} else {
			// When not streaming, update immediately for final content
			setDebouncedContent(content || "")
			// Cancel any pending debounced updates
			updateDebouncedContent.clear()
		}
	}, [content, isStreaming, updateDebouncedContent])

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			updateDebouncedContent.clear()
		}
	}, [updateDebouncedContent])

	// Only render markdown when there's actual content
	const hasContent = (debouncedContent?.trim()?.length ?? 0) > 0

	return (
		<div className="py-1">
			<div className="flex items-center justify-between mb-2.5 pr-2">
				<div className="flex items-center gap-2">
					<Lightbulb className="w-4" />
					<span className="font-bold text-vscode-foreground">{t("chat:reasoning.thinking")}</span>
				</div>
				<ElapsedTime isActive={isLast && isStreaming} startTime={startTimeRef.current} />
			</div>
			{hasContent && (
				<div className="px-3 italic text-vscode-descriptionForeground">
					<MarkdownBlock markdown={debouncedContent} />
				</div>
			)}
		</div>
	)
}
