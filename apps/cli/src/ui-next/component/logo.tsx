/**
 * Roo Code logo — kangaroo + ROOCODE block letters.
 * Hand-tuned from SVG render to match the brand logo.
 */

import { useTheme } from "../context/theme.js"
import { selectLogoForWidth } from "./logo-data.js"

export function Logo() {
	const { theme } = useTheme()
	const terminalWidth = process.stdout.columns ?? 120
	const logo = selectLogoForWidth(terminalWidth)

	return (
		<box flexDirection="column" alignItems="center">
			<text fg={theme.text}>{logo}</text>
		</box>
	)
}
