/**
 * Tips/hints component showing keyboard shortcuts in a clean grid.
 */

import { useTheme } from "../context/theme.js"

export function Tips() {
	const { theme } = useTheme()

	return (
		<box flexDirection="column" paddingTop={1} paddingLeft={2} paddingRight={2}>
			<box flexDirection="row" gap={2}>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.accent }}>@</span> files
				</text>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.accent }}>/</span> commands
				</text>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.accent }}>!</span> modes
				</text>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.accent }}>#</span> history
				</text>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.accent }}>?</span> help
				</text>
			</box>
			<box flexDirection="row" gap={2} paddingTop={0}>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.textMuted }}>Esc</span> cancel
				</text>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.textMuted }}>Ctrl+C</span> exit
				</text>
				<text fg={theme.dimText}>
					<span style={{ fg: theme.textMuted }}>Ctrl+M</span> switch mode
				</text>
			</box>
		</box>
	)
}
