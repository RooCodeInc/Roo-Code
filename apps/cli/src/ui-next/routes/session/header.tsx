/**
 * Session header component - displays mode, model, and metrics.
 */

import { Show, createMemo } from "solid-js"
import { useTheme } from "../../context/theme.js"
import { useExtension } from "../../context/extension.js"

export interface SessionHeaderProps {
	version: string
	mode: string
	provider: string
	model: string
}

export function SessionHeader(props: SessionHeaderProps) {
	const { theme } = useTheme()
	const ext = useExtension()

	const displayMode = createMemo(() => ext.state.currentMode || props.mode)

	const tokenDisplay = createMemo(() => {
		const usage = ext.state.tokenUsage
		if (!usage) return null
		const { totalTokensIn = 0, totalTokensOut = 0, totalCost } = usage
		const inK = (totalTokensIn / 1000).toFixed(1)
		const outK = (totalTokensOut / 1000).toFixed(1)
		let text = `${inK}k↑ ${outK}k↓`
		if (totalCost !== undefined && totalCost > 0) {
			text += ` $${totalCost.toFixed(4)}`
		}
		return text
	})

	return (
		<box flexDirection="row" flexShrink={0} paddingLeft={1} paddingRight={1}>
			<box flexGrow={1} flexDirection="row" gap={1}>
				<text fg={theme.titleColor} bold>
					Roo
				</text>
				<text fg={theme.dimText}>v{props.version}</text>
				<text fg={theme.dimText}>│</text>
				<text fg={theme.accent}>{displayMode()}</text>
				<text fg={theme.dimText}>│</text>
				<text fg={theme.textMuted}>{props.model}</text>
			</box>
			<Show when={tokenDisplay()}>{(tokens) => <text fg={theme.dimText}>{tokens()}</text>}</Show>
		</box>
	)
}
