import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import MarkdownBlock from "../common/MarkdownBlock"
import { vscode } from "@src/utils/vscode"

interface ReasoningMeta {
	startedAt?: number
	elapsedMs?: number
}

interface ReasoningBlockProps {
	content: string
	ts: number
	isStreaming: boolean
	isLast: boolean
	metadata?: { reasoning?: ReasoningMeta } | Record<string, any>
}

/**
 * Render reasoning with a heading and a persistent timer.
 * - Heading uses i18n key chat:reasoning.thinking
 * - Timer shown beside the heading and persists via message.metadata.reasoning { startedAt, elapsedMs }
 */
export const ReasoningBlock = ({ content, ts, isStreaming, isLast, metadata }: ReasoningBlockProps) => {
	const { t } = useTranslation()

	const persisted: ReasoningMeta = (metadata?.reasoning as ReasoningMeta) || {}
	const startedAtRef = useRef<number>(persisted.startedAt ?? Date.now())
	const [elapsed, setElapsed] = useState<number>(persisted.elapsedMs ?? 0)
	const postedRef = useRef<boolean>(false)

	// Initialize startedAt on first mount if missing (persist to task) - guard with postedRef
	useEffect(() => {
		if (!persisted.startedAt && isLast && !postedRef.current) {
			postedRef.current = true
			vscode.postMessage({
				type: "updateMessageReasoningMeta",
				messageTs: ts,
				reasoningMeta: { startedAt: startedAtRef.current },
			})
		}
	}, [ts, isLast, persisted.startedAt])

	// Tick while active (last row and streaming)
	useEffect(() => {
		const active = isLast && isStreaming
		if (!active) return

		const tick = () => setElapsed(Date.now() - startedAtRef.current)
		tick()
		const id = setInterval(tick, 1000)
		return () => clearInterval(id)
	}, [isLast, isStreaming])

	// Persist final elapsed when streaming stops
	const wasActiveRef = useRef<boolean>(false)
	useEffect(() => {
		const active = isLast && isStreaming
		if (wasActiveRef.current && !active) {
			const finalMs = Date.now() - startedAtRef.current
			setElapsed(finalMs)
			vscode.postMessage({
				type: "updateMessageReasoningMeta",
				messageTs: ts,
				reasoningMeta: { startedAt: startedAtRef.current, elapsedMs: finalMs },
			})
		}
		wasActiveRef.current = active
	}, [isLast, isStreaming, ts])

	const displayMs = useMemo(() => {
		if (isLast && isStreaming) return elapsed
		return persisted.elapsedMs ?? elapsed
	}, [elapsed, isLast, isStreaming, persisted.elapsedMs])

	const seconds = Math.max(0, Math.floor((displayMs || 0) / 1000))
	const secondsLabel = t("chat:reasoning.seconds", { count: seconds })

	return (
		<div className="py-1">
			<div className="flex items-center justify-between mb-2.5">
				<div className="flex items-center gap-2">
					<span className="codicon codicon-light-bulb text-vscode-charts-yellow" />
					<span className="font-bold text-vscode-foreground">{t("chat:reasoning.thinking")}</span>
				</div>
				<span className="text-vscode-foreground tabular-nums flex items-center gap-1">
					<span className="codicon codicon-clock text-base" />
					{secondsLabel}
				</span>
			</div>
			{(content?.trim()?.length ?? 0) > 0 && (
				<div className="px-3 italic text-vscode-descriptionForeground">
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
