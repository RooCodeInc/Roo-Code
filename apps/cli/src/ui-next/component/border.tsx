/**
 * Horizontal line/border component.
 */

import { useTheme } from "../context/theme.js"
import { useTerminalDimensions } from "@opentui/solid"

export function HorizontalLine(props: { active?: boolean }) {
	const { theme } = useTheme()
	const dims = useTerminalDimensions()

	const color = () => (props.active ? theme.borderActive : theme.border)
	const width = () => Math.max(dims().width - 2, 10)

	return <text fg={color()}>{"─".repeat(width())}</text>
}
