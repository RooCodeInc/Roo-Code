/**
 * TypeScript bindings for Rust file processor native module
 *
 * This module provides type-safe wrappers around the Rust native addon
 * for high-performance file processing operations.
 */

let nativeModule: any = null

/**
 * Lazily load the native module
 * This allows the application to run even if Rust modules aren't built yet
 */
function getNativeModule() {
	if (nativeModule === null) {
		try {
			// Try to load the native module
			// The actual .node file will be at ../../native/file-processor/index.node after build
			nativeModule = require("../../native/file-processor/index.node")
		} catch (error) {
			console.warn("[Native File Processor] Failed to load native module, falling back to JavaScript:", error)
			// Return null to indicate fallback should be used
			return null
		}
	}
	return nativeModule
}

/**
 * Result of file search operation
 */
export interface SearchMatch {
	line: number
	content: string
}

/**
 * Count lines in a file
 * Uses memory-mapped I/O for better performance on large files
 *
 * @param filePath - Path to the file
 * @returns Number of lines in the file
 * @throws Error if file cannot be read
 */
export function countLines(filePath: string): number {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: use Node.js fs (slower for large files)
		const fs = require("fs")
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")
		return lines.length
	}

	return native.countLines(filePath)
}

/**
 * Read entire file content
 * Uses memory-mapped I/O for better performance
 *
 * @param filePath - Path to the file
 * @returns File content as string
 * @throws Error if file cannot be read
 */
export function readFileContent(filePath: string): string {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: use Node.js fs
		const fs = require("fs")
		return fs.readFileSync(filePath, "utf8")
	}

	return native.readFileContent(filePath)
}

/**
 * Read a specific range of lines from a file
 *
 * @param filePath - Path to the file
 * @param startLine - Starting line number (1-indexed)
 * @param endLine - Ending line number (1-indexed, inclusive)
 * @returns Content of the specified line range
 * @throws Error if file cannot be read or range is invalid
 */
export function readLineRange(filePath: string, startLine: number, endLine: number): string {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: use Node.js fs
		const fs = require("fs")
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		if (startLine < 1 || endLine < 1 || startLine > endLine || startLine > lines.length) {
			throw new Error("Invalid line range")
		}

		const startIdx = startLine - 1
		const endIdx = Math.min(endLine, lines.length)
		return lines.slice(startIdx, endIdx).join("\n")
	}

	return native.readLineRange(filePath, startLine, endLine)
}

/**
 * Search for a regex pattern in a file
 * Returns all matching lines with their line numbers
 *
 * @param filePath - Path to the file
 * @param pattern - Regex pattern to search for
 * @returns Array of matches with line numbers
 * @throws Error if file cannot be read or regex is invalid
 */
export function searchInFile(filePath: string, pattern: string): SearchMatch[] {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: use Node.js fs and RegExp
		const fs = require("fs")
		const content = fs.readFileSync(filePath, "utf8")
		const regex = new RegExp(pattern)
		const matches: SearchMatch[] = []

		const lines = content.split("\n")
		for (let i = 0; i < lines.length; i++) {
			if (regex.test(lines[i])) {
				matches.push({
					line: i + 1,
					content: lines[i],
				})
			}
		}

		return matches
	}

	return native.searchInFile(filePath, pattern)
}

/**
 * Estimate token count for text
 * Uses a heuristic: approximately 4 characters per token
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: simple JavaScript heuristic
		const charCount = text.length
		const wordCount = text.split(/\s+/).length
		return Math.max(Math.floor(charCount / 4), Math.floor(wordCount / 0.75))
	}

	return native.estimateTokens(text)
}

/**
 * Get file size in bytes
 *
 * @param filePath - Path to the file
 * @returns File size in bytes
 * @throws Error if file cannot be accessed
 */
export function getFileSize(filePath: string): number {
	const native = getNativeModule()
	if (native === null) {
		// Fallback: use Node.js fs
		const fs = require("fs")
		const stats = fs.statSync(filePath)
		return stats.size
	}

	return native.getFileSize(filePath)
}

/**
 * Check if native module is available
 *
 * @returns true if native module is loaded, false otherwise
 */
export function isNativeAvailable(): boolean {
	return getNativeModule() !== null
}
