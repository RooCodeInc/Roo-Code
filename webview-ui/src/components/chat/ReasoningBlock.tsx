import React, { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import MarkdownBlock from "../common/MarkdownBlock"
import { Lightbulb, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReasoningBlockProps {
	content: string
	ts: number
	isStreaming: boolean
	isLast: boolean
	metadata?: any
}

/**
 * Render reasoning with a heading and a simple timer.
 * - Heading uses i18n key chat:reasoning.thinking
 * - Timer runs while reasoning is active (no persistence)
 * - Can be collapsed to show only last 2 lines of content
 */
export const ReasoningBlock = ({ content, isStreaming, isLast }: ReasoningBlockProps) => {
	const { t } = useTranslation()
	const { reasoningBlockCollapsed, setReasoningBlockCollapsed } = useExtensionState()

	// Initialize collapsed state based on global setting (default to collapsed)
	const [isCollapsed, setIsCollapsed] = useState(reasoningBlockCollapsed !== false)

	const startTimeRef = useRef<number>(Date.now())
	const [elapsed, setElapsed] = useState<number>(0)
	const contentRef = useRef<HTMLDivElement>(null)

	// Update collapsed state when global setting changes
	useEffect(() => {
		setIsCollapsed(reasoningBlockCollapsed !== false)
	}, [reasoningBlockCollapsed])

	// Handle keyboard shortcut for toggling collapsed state
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			// Ctrl/Cmd + Shift + T to toggle reasoning blocks
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
				e.preventDefault()
				const newState = !isCollapsed
				setIsCollapsed(newState)
				// Update global setting
				setReasoningBlockCollapsed(!newState)
				// Persist to backend
				vscode.postMessage({ type: "setReasoningBlockCollapsed", bool: !newState })
			}
		},
		[isCollapsed, setReasoningBlockCollapsed],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	// Simple timer that runs while streaming
	useEffect(() => {
		if (isLast && isStreaming) {
			const tick = () => setElapsed(Date.now() - startTimeRef.current)
			tick()
			const id = setInterval(tick, 1000)
			return () => clearInterval(id)
		}
	}, [isLast, isStreaming])

	const seconds = Math.floor(elapsed / 1000)
	const secondsLabel = t("chat:reasoning.seconds", { count: seconds })

	const handleToggle = () => {
		setIsCollapsed(!isCollapsed)
	}

	return (
		<div className="group">
			<div
				className="flex items-center justify-between mb-2.5 pr-2 cursor-pointer select-none"
				onClick={handleToggle}>
				<div className="flex items-center gap-2">
					<Lightbulb className="w-4" />
					<span className="font-bold text-vscode-foreground">{t("chat:reasoning.thinking")}</span>
					{elapsed > 0 && (
						<span className="text-sm text-vscode-descriptionForeground tabular-nums">{secondsLabel}</span>
					)}
				</div>
				<div className="opacity-0 group-hover:opacity-100 transition-opacity">
					{isCollapsed ? <ChevronRight className="w-4" /> : <ChevronDown className="w-4" />}
				</div>
			</div>
			{(content?.trim()?.length ?? 0) > 0 && (
				<div
					ref={contentRef}
					className={cn(
						"border-l border-vscode-descriptionForeground/20 ml-2 pl-4 pb-1 text-vscode-descriptionForeground",
						isCollapsed && "relative overflow-hidden",
					)}
					style={
						isCollapsed
							? {
									maxHeight: "3em", // Approximately 2 lines
									maskImage: "linear-gradient(to top, transparent 0%, black 30%)",
									WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 30%)",
								}
							: undefined
					}>
					{isCollapsed ? (
						// When collapsed, render content in a container that shows bottom-aligned text
						<div className="flex flex-col justify-end" style={{ minHeight: "3em" }}>
							<MarkdownBlock markdown={content} />
						</div>
					) : (
						<MarkdownBlock markdown={content} />
					)}
				</div>
			)}
		</div>
	)
}
