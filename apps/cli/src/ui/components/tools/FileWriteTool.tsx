import { Box, Text } from "ink"

import * as theme from "../../theme.js"
import { Icon } from "../Icon.js"

import type { ToolRendererProps } from "./types.js"
import { sanitizeContent, getToolDisplayName, getToolIconName, parseDiff } from "./utils.js"

const MAX_PREVIEW_LINES = 5

export function FileWriteTool({ toolData, rawContent }: ToolRendererProps) {
	const iconName = getToolIconName(toolData.tool)
	const displayName = getToolDisplayName(toolData.tool)
	const path = toolData.path || ""
	const diffStats = toolData.diffStats
	const diff = toolData.diff ? sanitizeContent(toolData.diff) : ""
	const isProtected = toolData.isProtected
	const isOutsideWorkspace = toolData.isOutsideWorkspace
	const isNewFile = toolData.tool === "newFileCreated" || toolData.tool === "write_to_file"

	// For streaming: rawContent is updated with each message, so parse it for live content
	// toolData.content may be stale during streaming due to debounce optimization
	let liveContent = toolData.content || ""
	if (rawContent && isNewFile) {
		try {
			const parsed = JSON.parse(rawContent) as Record<string, unknown>
			if (parsed.content && typeof parsed.content === "string") {
				liveContent = parsed.content
			}
		} catch {
			// Use toolData.content if rawContent isn't valid JSON
		}
	}

	// Handle batch diff operations
	if (toolData.batchDiffs && toolData.batchDiffs.length > 0) {
		return (
			<Box flexDirection="column" paddingX={1}>
				{/* Header */}
				<Box>
					<Icon name={iconName} color={theme.toolHeader} />
					<Text bold color={theme.toolHeader}>
						{" "}
						{displayName}
					</Text>
					<Text color={theme.dimText}> ({toolData.batchDiffs.length} files)</Text>
				</Box>

				{/* File list with stats */}
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					{toolData.batchDiffs.slice(0, 8).map((file, index) => (
						<Box key={index}>
							<Text color={theme.text} bold>
								{file.path}
							</Text>
							{file.diffStats && (
								<Box marginLeft={1}>
									<Text color={theme.successColor}>+{file.diffStats.added}</Text>
									<Text color={theme.dimText}> / </Text>
									<Text color={theme.errorColor}>-{file.diffStats.removed}</Text>
								</Box>
							)}
						</Box>
					))}
					{toolData.batchDiffs.length > 8 && (
						<Text color={theme.dimText}>... and {toolData.batchDiffs.length - 8} more files</Text>
					)}
				</Box>
			</Box>
		)
	}

	// Single file write
	// For new files, display streaming content; for edits, show diff
	const diffHunks = diff ? parseDiff(diff) : []

	// Process content for display - split into lines and truncate
	const sanitizedContent = isNewFile && liveContent ? sanitizeContent(liveContent) : ""
	const contentLines = sanitizedContent ? sanitizedContent.split("\n") : []
	const displayLines = contentLines.slice(0, MAX_PREVIEW_LINES)
	const truncatedLineCount = contentLines.length - MAX_PREVIEW_LINES
	const isContentTruncated = truncatedLineCount > 0

	// Stats for the header
	const totalLines = contentLines.length
	const totalChars = liveContent.length

	return (
		<Box flexDirection="column" paddingX={1} marginBottom={1}>
			{/* Header row with path on same line */}
			<Box>
				<Icon name={iconName} color={theme.toolHeader} />
				<Text bold color={theme.toolHeader}>
					{displayName}
				</Text>
				{path && (
					<>
						<Text color={theme.dimText}> · </Text>
						<Text color={theme.text} bold>
							{path}
						</Text>
					</>
				)}
				{isNewFile && !diffStats && (
					<Text color={theme.successColor} bold>
						{" "}
						NEW
					</Text>
				)}

				{/* Stats - show line/char count for streaming, or diff stats when complete */}
				{diffStats ? (
					<>
						<Text color={theme.dimText}> </Text>
						<Text color={theme.successColor} bold>
							+{diffStats.added}
						</Text>
						<Text color={theme.dimText}>/</Text>
						<Text color={theme.errorColor} bold>
							-{diffStats.removed}
						</Text>
					</>
				) : (
					isNewFile &&
					totalChars > 0 && (
						<Text color={theme.dimText}>
							{" "}
							({totalLines} lines, {totalChars} chars)
						</Text>
					)
				)}

				{/* Warning badges */}
				{isProtected && <Text color={theme.errorColor}> 🔒 protected</Text>}
				{isOutsideWorkspace && (
					<Text color={theme.warningColor} dimColor>
						{" "}
						⚠ outside workspace
					</Text>
				)}
			</Box>

			{/* Streaming content preview for new files (before diff is available) */}
			{isNewFile && !diff && displayLines.length > 0 && (
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					{displayLines.map((line, index) => (
						<Text key={index} color={theme.toolText}>
							{line}
						</Text>
					))}
					{isContentTruncated && (
						<Text color={theme.dimText} dimColor>
							... ({truncatedLineCount} more lines)
						</Text>
					)}
				</Box>
			)}

			{/* Diff preview for edits */}
			{diffHunks.length > 0 && (
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					{diffHunks.slice(0, 2).map((hunk, hunkIndex) => (
						<Box key={hunkIndex} flexDirection="column">
							{/* Hunk header */}
							<Text color={theme.focusColor} dimColor>
								{hunk.header}
							</Text>

							{/* Diff lines */}
							{hunk.lines.slice(0, 8).map((line, lineIndex) => (
								<Text
									key={lineIndex}
									color={
										line.type === "added"
											? theme.successColor
											: line.type === "removed"
												? theme.errorColor
												: theme.toolText
									}>
									{line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
									{line.content}
								</Text>
							))}

							{hunk.lines.length > 8 && (
								<Text color={theme.dimText} dimColor>
									... ({hunk.lines.length - 8} more lines in hunk)
								</Text>
							)}
						</Box>
					))}

					{diffHunks.length > 2 && (
						<Text color={theme.dimText} dimColor>
							... ({diffHunks.length - 2} more hunks)
						</Text>
					)}
				</Box>
			)}

			{/* Fallback: show raw diff content if no hunks parsed and not streaming new file */}
			{!isNewFile && diffHunks.length === 0 && diff && (
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					{diff
						.split("\n")
						.slice(0, MAX_PREVIEW_LINES)
						.map((line, index) => (
							<Text key={index} color={theme.toolText}>
								{line}
							</Text>
						))}
					{diff.split("\n").length > MAX_PREVIEW_LINES && (
						<Text color={theme.dimText} dimColor>
							... ({diff.split("\n").length - MAX_PREVIEW_LINES} more lines)
						</Text>
					)}
				</Box>
			)}
		</Box>
	)
}
