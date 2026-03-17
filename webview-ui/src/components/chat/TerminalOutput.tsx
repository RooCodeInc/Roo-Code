import React, { useMemo } from "react"
import Convert from "ansi-to-html"

interface TerminalOutputProps {
	content: string
	className?: string
}

// Create a single converter instance with sensible defaults
const converter = new Convert({
	fg: "var(--vscode-terminal-foreground, #cccccc)",
	bg: "var(--vscode-terminal-background, transparent)",
	// Map ANSI colors to VSCode terminal color CSS variables for theme compatibility
	colors: {
		0: "var(--vscode-terminal-ansiBlack, #000000)",
		1: "var(--vscode-terminal-ansiRed, #cd3131)",
		2: "var(--vscode-terminal-ansiGreen, #0dbc79)",
		3: "var(--vscode-terminal-ansiYellow, #e5e510)",
		4: "var(--vscode-terminal-ansiBlue, #2472c8)",
		5: "var(--vscode-terminal-ansiMagenta, #bc3fbc)",
		6: "var(--vscode-terminal-ansiCyan, #11a8cd)",
		7: "var(--vscode-terminal-ansiWhite, #e5e5e5)",
		8: "var(--vscode-terminal-ansiBrightBlack, #666666)",
		9: "var(--vscode-terminal-ansiBrightRed, #f14c4c)",
		10: "var(--vscode-terminal-ansiBrightGreen, #23d18b)",
		11: "var(--vscode-terminal-ansiBrightYellow, #f5f543)",
		12: "var(--vscode-terminal-ansiBrightBlue, #3b8eea)",
		13: "var(--vscode-terminal-ansiBrightMagenta, #d670d6)",
		14: "var(--vscode-terminal-ansiBrightCyan, #29b8db)",
		15: "var(--vscode-terminal-ansiBrightWhite, #e5e5e5)",
	},
	escapeXML: true, // Prevent XSS — escape HTML entities in the content
	newline: false, // We handle newlines ourselves via <pre>
})

/**
 * Renders terminal output with ANSI color/formatting support.
 *
 * Uses ansi-to-html to convert ANSI escape sequences into styled <span> elements.
 * Colors are mapped to VSCode terminal theme CSS variables for consistent theming.
 *
 * The component uses a monospace font and preserves whitespace/newlines
 * to match terminal rendering behavior.
 */
export const TerminalOutput: React.FC<TerminalOutputProps> = ({ content, className }) => {
	const html = useMemo(() => {
		try {
			return converter.toHtml(content)
		} catch {
			// Fallback: if conversion fails, show raw text (stripped of ANSI)
			// eslint-disable-next-line no-control-regex
			return content.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
		}
	}, [content])

	return (
		<pre
			className={className}
			style={{
				fontFamily:
					"var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace)",
				fontSize: "var(--vscode-editor-font-size, 13px)",
				lineHeight: "var(--vscode-editor-line-height, 1.4)",
				whiteSpace: "pre-wrap",
				wordBreak: "break-word",
				margin: 0,
				padding: "8px 12px",
				backgroundColor: "var(--vscode-terminal-background, transparent)",
				color: "var(--vscode-terminal-foreground, inherit)",
				overflow: "auto",
				// Support Unicode box-drawing characters and extended ASCII
				unicodeBidi: "embed",
			}}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	)
}
