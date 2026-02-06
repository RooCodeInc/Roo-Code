/**
 * Help overlay showing keyboard shortcuts.
 * Activated by typing `?` as the first character in an empty input.
 */

import { For, Show } from "solid-js"
import { useTheme } from "../context/theme.js"

export interface HelpShortcut {
	shortcut: string
	description: string
}

const SHORTCUTS: HelpShortcut[] = [
	{ shortcut: "/", description: "Slash commands" },
	{ shortcut: "@", description: "Mention files" },
	{ shortcut: "!", description: "Switch mode" },
	{ shortcut: "#", description: "Resume task from history" },
	{ shortcut: "Esc", description: "Cancel current task" },
	{ shortcut: "Tab", description: "Toggle focus" },
	{ shortcut: "Ctrl+M", description: "Cycle modes" },
	{ shortcut: "Ctrl+C", description: "Exit (press twice)" },
	{ shortcut: "Alt+Enter", description: "New line" },
]

export interface HelpOverlayProps {
	visible: boolean
}

export function HelpOverlay(props: HelpOverlayProps) {
	const { theme } = useTheme()

	return (
		<Show when={props.visible}>
			<box
				flexDirection="column"
				borderStyle="rounded"
				borderColor={theme.borderActive}
				flexShrink={0}
				paddingLeft={1}
				paddingRight={1}>
				<text fg={theme.primary} bold>
					Keyboard Shortcuts
				</text>
				<For each={SHORTCUTS}>
					{(item) => (
						<box flexDirection="row">
							<text fg={theme.accent} bold>
								{"  "}
								{item.shortcut.padEnd(12)}
							</text>
							<text fg={theme.dimText}>{item.description}</text>
						</box>
					)}
				</For>
				<text fg={theme.dimText}>{"  "}Press Esc to dismiss</text>
			</box>
		</Show>
	)
}
