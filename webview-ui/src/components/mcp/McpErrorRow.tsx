import { useMemo } from "react"
import { formatRelative } from "date-fns"

import type { McpErrorEntry } from "@roo/shared/mcp"

type McpErrorRowProps = {
	error: McpErrorEntry
}

export const McpErrorRow = ({ error }: McpErrorRowProps) => {
	const color = useMemo(() => {
		// Add debugging to log what level is coming in
		console.log(`McpErrorRow level: ${error.level} for message: ${error.message.substring(0, 20)}...`)

		// Check if this is a stdout message (mapped to info in backend)
		// Common patterns for stdout messages
		const isStdoutMessage =
			error.level === "info" &&
			(/Server .* stdout:/.test(error.message) ||
				/MCP Server .* running on stdio/.test(error.message) ||
				/INFO/i.test(error.message) ||
				/Server running/i.test(error.message) ||
				/Documentation MCP Server/i.test(error.message) ||
				/running on stdio/i.test(error.message))

		if (isStdoutMessage) {
			// Use regular foreground color for stdout messages
			return "var(--vscode-foreground)"
		}

		switch (error.level) {
			case "error":
				return "var(--vscode-testing-iconFailed)"
			case "warn":
				return "var(--vscode-charts-yellow)"
			case "info":
				return "var(--vscode-testing-iconPassed)"
			case "stdout": // Keep for backward compatibility
				return "var(--vscode-foreground)"
			default:
				// For any unexpected value, default to error color
				console.warn(`Unknown error level: ${error.level}`)
				return "var(--vscode-testing-iconFailed)"
		}
	}, [error.level, error.message])

	return (
		<div className="text-sm bg-vscode-textCodeBlock-background border-l-2 p-2" style={{ borderColor: color }}>
			<div className="mb-1" style={{ color }}>
				{error.message}
			</div>
			<div className="text-xs text-vscode-descriptionForeground">
				{formatRelative(error.timestamp, new Date())}
			</div>
		</div>
	)
}
