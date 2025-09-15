import React, { memo, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

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
 */
export const ReasoningBlock = ({ content, isStreaming, isLast }: ReasoningBlockProps) => {
	const { t } = useTranslation()
	const startTimeRef = useRef<number>(Date.now())

	// Only render markdown when there's actual content
	const hasContent = (content?.trim()?.length ?? 0) > 0

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
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
