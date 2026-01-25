import path from "path"
import * as fs from "fs/promises"
import { createReadStream } from "fs"
import { createInterface } from "readline"
import { isBinaryFile } from "isbinaryfile"

import type { ReadFileInput, ReadFileOutput, ReadFileSuccess } from "@roo-code/types"

import { Task } from "../task/Task"
import type { ToolUse } from "../../shared/tools"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { BaseTool, ToolCallbacks } from "./BaseTool"

// Default constants matching spec
const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 2000
const DEFAULT_FORMAT = "cat_n"
const DEFAULT_MAX_CHARS_PER_LINE = 2000
const MAX_TOTAL_CHARS = 10_000_000 // 10MB text budget

/**
 * Format line number with right alignment (cat -n style)
 * @param lineNum The 1-based line number
 * @param maxLineNum The maximum line number in this chunk (for width calculation)
 * @returns Formatted line number string
 */
function formatLineNumber(lineNum: number, maxLineNum: number): string {
	const width = String(maxLineNum).length
	return String(lineNum).padStart(width, " ")
}

/**
 * Truncate a line if it exceeds max length
 * @param line The line content
 * @param maxChars Maximum characters allowed
 * @returns Truncated line with marker if truncated
 */
function truncateLine(line: string, maxChars: number): { line: string; truncated: boolean } {
	if (line.length <= maxChars) {
		return { line, truncated: false }
	}
	return { line: line.substring(0, maxChars) + "… [line truncated]", truncated: true }
}

/**
 * Read file with streaming and pagination support
 * @param filePath Absolute path to file
 * @param offset 0-based line offset
 * @param limit Maximum lines to read
 * @param maxCharsPerLine Maximum characters per line
 * @returns Object with content, metadata, and pagination info
 */
async function readFileWithPagination(
	filePath: string,
	offset: number,
	limit: number,
	maxCharsPerLine: number,
): Promise<{
	lines: string[]
	reachedEof: boolean
	linesTruncated: boolean
	totalCharsTruncated: boolean
}> {
	const lines: string[] = []
	let currentLine = 0
	let reachedEof = true
	let linesTruncated = false
	let totalChars = 0
	let totalCharsTruncated = false

	const fileStream = createReadStream(filePath, { encoding: "utf8" })
	const rl = createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	})

	try {
		for await (const line of rl) {
			// Skip lines before offset
			if (currentLine < offset) {
				currentLine++
				continue
			}

			// Check if we've reached the limit
			if (lines.length >= limit) {
				reachedEof = false
				break
			}

			// Check total chars budget
			if (totalChars + line.length > MAX_TOTAL_CHARS) {
				totalCharsTruncated = true
				reachedEof = false
				break
			}

			// Truncate line if needed
			const { line: truncatedLine, truncated } = truncateLine(line, maxCharsPerLine)
			if (truncated) {
				linesTruncated = true
			}

			lines.push(truncatedLine)
			totalChars += truncatedLine.length
			currentLine++
		}
	} finally {
		rl.close()
		fileStream.destroy()
	}

	return { lines, reachedEof, linesTruncated, totalCharsTruncated }
}

/**
 * Format lines with cat -n style line numbers
 * @param lines Array of line content
 * @param startLine 1-based starting line number
 * @returns Formatted content string
 */
function formatWithLineNumbers(lines: string[], startLine: number): string {
	if (lines.length === 0) {
		return ""
	}

	const endLine = startLine + lines.length - 1
	const maxLineNum = endLine

	return lines
		.map((line, index) => {
			const lineNum = startLine + index
			return `${formatLineNumber(lineNum, maxLineNum)}  ${line}`
		})
		.join("\n")
}

export class ReadFileTool extends BaseTool<"read_file"> {
	readonly name = "read_file" as const

	async execute(params: ReadFileInput, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { pushToolResult } = callbacks

		// Extract and validate parameters
		const filePath = params.file_path
		const offset = params.offset ?? DEFAULT_OFFSET
		const limit = params.limit ?? DEFAULT_LIMIT
		const format = params.format ?? DEFAULT_FORMAT
		const maxCharsPerLine = params.max_chars_per_line ?? DEFAULT_MAX_CHARS_PER_LINE

		// Validate offset and limit
		if (offset < 0) {
			const error: ReadFileOutput = {
				ok: false,
				error: {
					code: "io_error",
					message: "Invalid offset: must be >= 0",
					details: { offset },
				},
			}
			pushToolResult(JSON.stringify(error, null, 2))
			return
		}

		if (limit <= 0 || limit > DEFAULT_LIMIT) {
			const error: ReadFileOutput = {
				ok: false,
				error: {
					code: "io_error",
					message: `Invalid limit: must be between 1 and ${DEFAULT_LIMIT}`,
					details: { limit, max: DEFAULT_LIMIT },
				},
			}
			pushToolResult(JSON.stringify(error, null, 2))
			return
		}

		// Resolve path
		const fullPath = path.resolve(task.cwd, filePath)
		const resolvedPath = await fs.realpath(fullPath).catch(() => fullPath)

		// Check workspace sandbox
		if (isPathOutsideWorkspace(resolvedPath)) {
			const error: ReadFileOutput = {
				ok: false,
				error: {
					code: "outside_workspace",
					message: `Access denied: path is outside workspace root`,
					details: { requested_path: filePath, resolved_path: resolvedPath },
				},
			}
			pushToolResult(JSON.stringify(error, null, 2))
			task.didToolFailInCurrentTurn = true
			return
		}

		try {
			// Check if file exists and get stats
			const stats = await fs.stat(resolvedPath)

			// Reject directories
			if (stats.isDirectory()) {
				const error: ReadFileOutput = {
					ok: false,
					error: {
						code: "is_directory",
						message: `Cannot read directory. Use list_files tool to view directory contents.`,
						details: { path: filePath },
					},
				}
				pushToolResult(JSON.stringify(error, null, 2))
				task.didToolFailInCurrentTurn = true
				return
			}

			// Check if file is binary
			const isBinary = await isBinaryFile(resolvedPath)
			if (isBinary) {
				const error: ReadFileOutput = {
					ok: false,
					error: {
						code: "unsupported_mime_type",
						message: `Binary files are not supported by read_file tool`,
						details: { path: filePath },
					},
				}
				pushToolResult(JSON.stringify(error, null, 2))
				task.didToolFailInCurrentTurn = true
				return
			}

			// Detect MIME type (simple extension-based detection)
			const ext = path.extname(resolvedPath).toLowerCase()
			const mimeType =
				ext === ".ts" || ext === ".tsx"
					? "text/typescript"
					: ext === ".js" || ext === ".jsx"
						? "text/javascript"
						: ext === ".json"
							? "application/json"
							: ext === ".md"
								? "text/markdown"
								: ext === ".html"
									? "text/html"
									: ext === ".css"
										? "text/css"
										: "text/plain"
			const encoding = "utf-8"

			// Read file with pagination
			const { lines, reachedEof, linesTruncated, totalCharsTruncated } = await readFileWithPagination(
				resolvedPath,
				offset,
				limit,
				maxCharsPerLine,
			)

			const linesReturned = lines.length
			const lineOffset = offset
			const nextOffset = reachedEof ? null : offset + linesReturned

			// Format content based on format parameter
			let content = ""
			if (format === "cat_n" && linesReturned > 0) {
				const startLine = lineOffset + 1 // Convert 0-based offset to 1-based line number
				content = formatWithLineNumbers(lines, startLine)
			}

			// Determine truncation status
			const truncated = !reachedEof || linesTruncated || totalCharsTruncated
			let truncationReason: ReadFileSuccess["truncation_reason"]
			if (totalCharsTruncated) {
				truncationReason = "max_total_chars"
			} else if (linesTruncated) {
				truncationReason = "max_chars_per_line"
			} else if (!reachedEof) {
				truncationReason = "limit"
			}

			// Build warnings array
			const warnings: string[] = []
			if (linesTruncated) {
				warnings.push(`Some lines exceeded ${maxCharsPerLine} characters and were truncated`)
			}
			if (totalCharsTruncated) {
				warnings.push(`Total character budget of ${MAX_TOTAL_CHARS} exceeded, read stopped early`)
			}

			// Build success response
			const success: ReadFileOutput = {
				ok: true,
				file_path: filePath,
				resolved_path: resolvedPath,
				mime_type: mimeType,
				encoding,
				line_offset: lineOffset,
				lines_returned: linesReturned,
				reached_eof: reachedEof,
				truncated,
				truncation_reason: truncationReason,
				next_offset: nextOffset,
				content,
				warnings,
			}

			pushToolResult(JSON.stringify(success, null, 2))
		} catch (error: any) {
			// Handle various error cases
			let errorCode: "file_not_found" | "permission_denied" | "io_error" = "io_error"
			let message = error.message || String(error)

			if (error.code === "ENOENT") {
				errorCode = "file_not_found"
				message = `File not found: ${filePath}`
			} else if (error.code === "EACCES" || error.code === "EPERM") {
				errorCode = "permission_denied"
				message = `Permission denied: ${filePath}`
			}

			const errorResponse: ReadFileOutput = {
				ok: false,
				error: {
					code: errorCode,
					message,
					details: { path: filePath, error_code: error.code },
				},
			}

			pushToolResult(JSON.stringify(errorResponse, null, 2))
			task.didToolFailInCurrentTurn = true
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"read_file">): Promise<void> {
		// No-op for new implementation (no streaming UI needed for simple reads)
	}
}

export const readFileTool = new ReadFileTool()
