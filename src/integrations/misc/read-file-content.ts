/**
 * Read file content utilities with advanced features:
 * - Slice mode: Simple line-by-line reading with offset and limit
 * - Indentation mode: Smart extraction of code blocks based on indentation levels
 */
import { createReadStream } from "fs"

// Configuration constants
const MAX_LINE_LENGTH = 500 // Truncate lines longer than this
const TAB_WIDTH = 4 // Treat tabs as 4 spaces for indentation
const FALLBACK_LIMIT = 500 // Fallback when no limit is specified and maxReadFileLine is not set

// Comment prefixes for header detection
const COMMENT_PREFIXES = ["#", "//", "--", "/*", "*", "'''", '"""', "<!--"]

/**
 * Record for a single line in a file
 */
export interface LineRecord {
	number: number // 1-indexed line number
	raw: string // Original line content
	display: string // Formatted/truncated line for output
	indent: number // Measured indentation in spaces
}

/**
 * Configuration for indentation mode
 */
export interface IndentationConfig {
	anchorLine?: number // The line to anchor the block expansion from (defaults to offset)
	maxLevels?: number // Maximum indentation depth to collect; 0 = unlimited
	includeSiblings?: boolean // Whether to include sibling blocks at same indentation level
	includeHeader?: boolean // Whether to include comment headers above the anchor block
	maxLines?: number // Hard cap on returned lines (defaults to limit)
}

/**
 * Read mode options
 */
export type ReadMode = "slice" | "indentation"

/**
 * Options for reading file content
 */
export interface ReadFileContentOptions {
	filePath: string
	offset?: number // 1-indexed line number to start reading from (default: 1)
	limit?: number // Maximum number of lines to return (uses defaultLimit if not specified)
	mode?: ReadMode // Either "slice" or "indentation" (default: "slice")
	indentation?: IndentationConfig // Configuration for indentation mode
	defaultLimit?: number // Default limit to use when limit is not specified (usually from maxReadFileLine setting)
}

/**
 * Metadata about the file read operation for pagination awareness
 */
export interface ReadFileMetadata {
	/** The file path that was read */
	filePath: string
	/** Total number of lines in the file */
	totalLinesInFile: number
	/** Number of lines returned in the response */
	linesReturned: number
	/** First line number in the response (1-indexed) */
	startLine: number
	/** Last line number in the response (1-indexed) */
	endLine: number
	/** True if there are lines before startLine */
	hasMoreBefore: boolean
	/** True if there are lines after endLine */
	hasMoreAfter: boolean
	/** Count of lines before the returned content */
	linesBeforeStart: number
	/** Count of lines after the returned content */
	linesAfterEnd: number
	/** True if reading stopped due to limit parameter */
	truncatedByLimit: boolean
	/** Line numbers where content was truncated due to MAX_LINE_LENGTH */
	lineLengthTruncations: number[]
}

/**
 * Result of reading file content
 */
export interface ReadFileContentResult {
	content: string // The formatted content with line numbers
	lineCount: number // Number of lines returned
	totalLines: number // Total lines in file (for slice mode)
	metadata: ReadFileMetadata // Detailed metadata for pagination awareness
}

/**
 * Check if a line is a comment line
 */
function isCommentLine(line: string): boolean {
	const trimmed = line.trim()
	return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
}

/**
 * Check if a line is blank (whitespace only)
 */
function isBlankLine(line: string): boolean {
	return line.trim().length === 0
}

/**
 * Measure indentation of a line, treating tabs as TAB_WIDTH spaces
 */
export function measureIndent(line: string): number {
	let indent = 0
	for (const char of line) {
		if (char === " ") {
			indent += 1
		} else if (char === "\t") {
			indent += TAB_WIDTH
		} else {
			break
		}
	}
	return indent
}

/**
 * Compute effective indentation for each line, propagating through blanks
 * Blank lines inherit the indentation of the previous non-blank line
 */
function computeEffectiveIndents(records: LineRecord[]): number[] {
	const effective: number[] = []
	let previousIndent = 0

	for (const record of records) {
		if (isBlankLine(record.raw)) {
			effective.push(previousIndent)
		} else {
			previousIndent = record.indent
			effective.push(previousIndent)
		}
	}

	return effective
}

/**
 * Create a LineRecord from a line of text
 */
function createLineRecord(lineNumber: number, raw: string): LineRecord {
	const indent = measureIndent(raw)
	const display = raw.length > MAX_LINE_LENGTH ? raw.substring(0, MAX_LINE_LENGTH) : raw

	return {
		number: lineNumber,
		raw,
		display,
		indent,
	}
}

/**
 * Collect all lines from a file into LineRecord array
 */
async function collectFileLines(filePath: string): Promise<LineRecord[]> {
	return new Promise((resolve, reject) => {
		const records: LineRecord[] = []
		let lineNumber = 0
		let buffer = ""

		const input = createReadStream(filePath)

		input.on("error", reject)

		input.on("data", (chunk) => {
			buffer += chunk.toString()

			let pos = 0
			let nextNewline = buffer.indexOf("\n", pos)

			while (nextNewline !== -1) {
				let line = buffer.substring(pos, nextNewline)
				// Strip \r if present (CRLF)
				if (line.endsWith("\r")) {
					line = line.slice(0, -1)
				}

				lineNumber++
				records.push(createLineRecord(lineNumber, line))

				pos = nextNewline + 1
				nextNewline = buffer.indexOf("\n", pos)
			}

			// Keep incomplete line in buffer
			buffer = buffer.substring(pos)
		})

		input.on("end", () => {
			// Process any remaining data (last line without newline)
			if (buffer.length > 0) {
				lineNumber++
				records.push(createLineRecord(lineNumber, buffer))
			}
			resolve(records)
		})
	})
}

/**
 * Read file using slice mode - simple line-by-line reading with offset and limit
 */
export async function readSlice(
	filePath: string,
	offset: number = 1,
	limit: number = FALLBACK_LIMIT,
): Promise<ReadFileContentResult> {
	if (offset === 0) {
		throw new RangeError("offset must be a 1-indexed line number")
	}
	if (limit === 0) {
		throw new RangeError("limit must be greater than zero")
	}

	return new Promise((resolve, reject) => {
		const collected: string[] = []
		const lineLengthTruncations: number[] = []
		let lineNumber = 0
		let buffer = ""
		let startLine = 0
		let endLine = 0
		let truncatedByLimit = false

		const input = createReadStream(filePath)

		input.on("error", reject)

		input.on("data", (chunk) => {
			buffer += chunk.toString()

			let pos = 0
			let nextNewline = buffer.indexOf("\n", pos)

			while (nextNewline !== -1) {
				let line = buffer.substring(pos, nextNewline)
				// Strip \r if present (CRLF)
				if (line.endsWith("\r")) {
					line = line.slice(0, -1)
				}

				lineNumber++

				// Only collect content if we haven't hit the limit yet
				if (!truncatedByLimit && lineNumber >= offset && collected.length < limit) {
					// Track first line collected
					if (startLine === 0) {
						startLine = lineNumber
					}
					endLine = lineNumber

					// Truncate long lines and track truncation
					let display = line
					if (line.length > MAX_LINE_LENGTH) {
						display = line.substring(0, MAX_LINE_LENGTH)
						lineLengthTruncations.push(lineNumber)
					}
					collected.push(`${lineNumber} | ${display}`)

					// Check if we've hit the limit
					if (collected.length >= limit) {
						truncatedByLimit = true
						// Continue counting lines instead of destroying stream
					}
				}

				pos = nextNewline + 1
				nextNewline = buffer.indexOf("\n", pos)
			}

			buffer = buffer.substring(pos)
		})

		input.on("end", () => {
			// Process any remaining data (last line without newline)
			if (buffer.length > 0) {
				lineNumber++
				if (!truncatedByLimit && lineNumber >= offset && collected.length < limit) {
					if (startLine === 0) {
						startLine = lineNumber
					}
					endLine = lineNumber

					let display = buffer
					if (buffer.length > MAX_LINE_LENGTH) {
						display = buffer.substring(0, MAX_LINE_LENGTH)
						lineLengthTruncations.push(lineNumber)
					}
					collected.push(`${lineNumber} | ${display}`)
				}
			}

			// Handle offset beyond EOF gracefully - return empty content instead of throwing
			const totalLines = lineNumber
			if (totalLines === 0 || offset > totalLines) {
				resolve({
					content: "",
					lineCount: 0,
					totalLines,
					metadata: {
						filePath,
						totalLinesInFile: totalLines,
						linesReturned: 0,
						startLine: offset,
						endLine: offset,
						hasMoreBefore: offset > 1 && totalLines > 0,
						hasMoreAfter: false,
						linesBeforeStart: Math.min(offset - 1, totalLines),
						linesAfterEnd: 0,
						truncatedByLimit: false,
						lineLengthTruncations: [],
					},
				})
				return
			}

			const linesReturned = collected.length
			const linesAfterEnd = endLine > 0 ? totalLines - endLine : 0

			resolve({
				content: collected.join("\n"),
				lineCount: linesReturned,
				totalLines,
				metadata: {
					filePath,
					totalLinesInFile: totalLines,
					linesReturned,
					startLine: startLine || offset,
					endLine: endLine || offset,
					hasMoreBefore: (startLine || offset) > 1,
					hasMoreAfter: linesAfterEnd > 0,
					linesBeforeStart: (startLine || offset) - 1,
					linesAfterEnd,
					truncatedByLimit,
					lineLengthTruncations,
				},
			})
		})
	})
}

/**
 * Read file using indentation mode - smart extraction of code blocks
 */
export async function readIndentationBlock(
	filePath: string,
	offset: number = 1,
	limit: number = FALLBACK_LIMIT,
	config: IndentationConfig = {},
): Promise<ReadFileContentResult> {
	const {
		anchorLine = offset,
		maxLevels = 0,
		includeSiblings = false,
		includeHeader = true,
		maxLines = limit,
	} = config

	if (anchorLine === 0) {
		throw new RangeError("anchorLine must be a 1-indexed line number")
	}
	if (maxLines === 0) {
		throw new RangeError("maxLines must be greater than zero")
	}

	// Load all lines
	const records = await collectFileLines(filePath)

	if (records.length === 0 || anchorLine > records.length) {
		throw new RangeError("anchorLine exceeds file length")
	}

	const anchorIndex = anchorLine - 1
	const effectiveIndents = computeEffectiveIndents(records)
	const anchorIndent = effectiveIndents[anchorIndex]

	// Calculate minimum indentation threshold
	let minIndent: number
	if (maxLevels === 0) {
		minIndent = 0
	} else {
		minIndent = Math.max(0, anchorIndent - maxLevels * TAB_WIDTH)
	}

	// Cap by limits
	const finalLimit = Math.min(limit, maxLines, records.length)

	// Special case: single line
	if (finalLimit === 1) {
		const r = records[anchorIndex]
		const lineLengthTruncations: number[] = r.raw.length > MAX_LINE_LENGTH ? [r.number] : []
		return {
			content: `${r.number} | ${r.display}`,
			lineCount: 1,
			totalLines: records.length,
			metadata: {
				filePath,
				totalLinesInFile: records.length,
				linesReturned: 1,
				startLine: r.number,
				endLine: r.number,
				hasMoreBefore: r.number > 1,
				hasMoreAfter: r.number < records.length,
				linesBeforeStart: r.number - 1,
				linesAfterEnd: records.length - r.number,
				truncatedByLimit: true,
				lineLengthTruncations,
			},
		}
	}

	// Bidirectional expansion from anchor using a deque-like array
	const out: LineRecord[] = [records[anchorIndex]]
	let i = anchorIndex - 1 // upward cursor
	let j = anchorIndex + 1 // downward cursor
	let iMinIndentCount = 0
	let jMinIndentCount = 0

	while (out.length < finalLimit) {
		let progressed = 0

		// Expand upward
		if (i >= 0) {
			if (effectiveIndents[i] >= minIndent) {
				out.unshift(records[i])
				progressed++

				// Handle sibling exclusion
				if (effectiveIndents[i] === minIndent && !includeSiblings) {
					const allowHeader = includeHeader && isCommentLine(records[i].raw)
					const canTake = allowHeader || iMinIndentCount === 0

					if (canTake) {
						iMinIndentCount++
					} else {
						out.shift()
						progressed--
						i = -1 // Stop upward expansion
					}
				}

				if (i >= 0) {
					i--
				}

				if (out.length >= finalLimit) {
					break
				}
			} else {
				i = -1 // Stop upward expansion
			}
		}

		// Expand downward
		if (j < records.length) {
			if (effectiveIndents[j] >= minIndent) {
				out.push(records[j])
				progressed++

				// Handle sibling exclusion
				if (effectiveIndents[j] === minIndent && !includeSiblings) {
					if (jMinIndentCount > 0) {
						out.pop()
						progressed--
						j = records.length // Stop downward expansion
					}
					jMinIndentCount++
				}

				if (j < records.length) {
					j++
				}
			} else {
				j = records.length // Stop downward expansion
			}
		}

		if (progressed === 0) {
			break
		}
	}

	// Trim leading/trailing empty lines
	while (out.length > 0 && isBlankLine(out[0].raw)) {
		out.shift()
	}
	while (out.length > 0 && isBlankLine(out[out.length - 1].raw)) {
		out.pop()
	}

	// Track line length truncations
	const lineLengthTruncations: number[] = out.filter((r) => r.raw.length > MAX_LINE_LENGTH).map((r) => r.number)

	// Format output
	const content = out.map((r) => `${r.number} | ${r.display}`).join("\n")

	// Calculate metadata
	const linesReturned = out.length
	const startLine = out.length > 0 ? out[0].number : anchorLine
	const endLine = out.length > 0 ? out[out.length - 1].number : anchorLine
	const totalLines = records.length
	const linesAfterEnd = totalLines - endLine

	// Determine if truncated by limit (expansion stopped due to limit, not natural boundaries)
	const truncatedByLimit = out.length >= finalLimit

	return {
		content,
		lineCount: linesReturned,
		totalLines,
		metadata: {
			filePath,
			totalLinesInFile: totalLines,
			linesReturned,
			startLine,
			endLine,
			hasMoreBefore: startLine > 1,
			hasMoreAfter: linesAfterEnd > 0,
			linesBeforeStart: startLine - 1,
			linesAfterEnd,
			truncatedByLimit,
			lineLengthTruncations,
		},
	}
}

/**
 * Main function to read file content with either slice or indentation mode
 */
export async function readFileContent(options: ReadFileContentOptions): Promise<ReadFileContentResult> {
	const { filePath, offset = 1, limit, mode = "slice", indentation, defaultLimit } = options

	// Use provided limit, or defaultLimit (from maxReadFileLine setting), or fallback
	const effectiveLimit = limit ?? defaultLimit ?? FALLBACK_LIMIT

	if (mode === "indentation") {
		return readIndentationBlock(filePath, offset, effectiveLimit, indentation)
	} else {
		return readSlice(filePath, offset, effectiveLimit)
	}
}

/**
 * Add line numbers to content string (for compatibility with existing code)
 */
export function addLineNumbers(content: string, startLine: number = 1): string {
	const lines = content.split("\n")
	return lines.map((line, index) => `${startLine + index} | ${line}`).join("\n")
}
