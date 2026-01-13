/**
 * Format Utilities
 *
 * Shared formatting and content extraction utilities for ACP.
 * Extracted to eliminate code duplication across modules.
 */

import * as fs from "node:fs"
import * as fsPromises from "node:fs/promises"
import * as path from "node:path"

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default configuration for content formatting.
 */
export interface FormatConfig {
	/** Maximum number of lines to show for read results */
	maxReadLines: number
}

export const DEFAULT_FORMAT_CONFIG: FormatConfig = {
	maxReadLines: 100,
}

// =============================================================================
// Result Type for Error Handling
// =============================================================================

/**
 * Result type for operations that can fail.
 * Provides explicit success/failure indication instead of returning error strings.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Create a successful result.
 */
export function ok<T>(value: T): Result<T> {
	return { ok: true, value }
}

/**
 * Create a failed result.
 */
export function err<T>(error: string): Result<T> {
	return { ok: false, error }
}

// =============================================================================
// Search Result Formatting
// =============================================================================

/**
 * Format search results into a clean summary with file list.
 *
 * Input format (verbose):
 * ```
 * Found 112 results.
 *
 * # src/acp/__tests__/agent.test.ts
 *   9 |
 *  10 | // Mock the auth module
 * ...
 *
 * # README.md
 * 105 |
 * ...
 * ```
 *
 * Output format (clean):
 * ```
 * Found 112 results in 20 files
 *
 * - src/acp/__tests__/agent.test.ts
 * - README.md
 * ...
 * ```
 */
export function formatSearchResults(content: string): string {
	// Extract count from "Found X results" line
	const countMatch = content.match(/Found (\d+) results?/)
	const resultCount = countMatch?.[1] ? parseInt(countMatch[1], 10) : null

	// Extract unique file paths from "# path/to/file" lines
	const filePattern = /^# (.+)$/gm
	const files = new Set<string>()
	let match
	while ((match = filePattern.exec(content)) !== null) {
		if (match[1]) {
			files.add(match[1])
		}
	}

	// Sort files alphabetically
	const fileList = Array.from(files).sort((a, b) => a.localeCompare(b))

	// Build the formatted output
	if (fileList.length === 0) {
		// No files found, return first line (might be "No results found" or similar)
		return content.split("\n")[0] || content
	}

	const summary =
		resultCount !== null
			? `Found ${resultCount} result${resultCount !== 1 ? "s" : ""} in ${fileList.length} file${fileList.length !== 1 ? "s" : ""}`
			: `Found matches in ${fileList.length} file${fileList.length !== 1 ? "s" : ""}`

	// Use markdown list format
	const formattedFiles = fileList.map((f) => `- ${f}`).join("\n")

	return `${summary}\n\n${formattedFiles}`
}

// =============================================================================
// Read Content Formatting
// =============================================================================

/**
 * Format read results by truncating long file contents.
 *
 * @param content - The raw file content
 * @param config - Optional configuration overrides
 * @returns Truncated content with indicator if truncated
 */
export function formatReadContent(content: string, config: FormatConfig = DEFAULT_FORMAT_CONFIG): string {
	const lines = content.split("\n")

	if (lines.length <= config.maxReadLines) {
		return content
	}

	// Truncate and add indicator
	const truncated = lines.slice(0, config.maxReadLines).join("\n")
	const remaining = lines.length - config.maxReadLines
	return `${truncated}\n\n... (${remaining} more lines)`
}

// =============================================================================
// Code Block Wrapping
// =============================================================================

/**
 * Wrap content in markdown code block for better rendering.
 *
 * @param content - Content to wrap
 * @param language - Optional language for syntax highlighting
 * @returns Content wrapped in markdown code fences
 */
export function wrapInCodeBlock(content: string, language?: string): string {
	const fence = language ? `\`\`\`${language}` : "```"
	return `${fence}\n${content}\n\`\`\``
}

// =============================================================================
// Content Extraction from Raw Input
// =============================================================================

/**
 * Common field names to check when extracting content from tool parameters.
 */
const CONTENT_FIELDS = ["content", "text", "result", "output", "fileContent", "data"] as const

/**
 * Extract content from raw input parameters.
 *
 * Tries common field names for content. Returns the first non-empty string found.
 *
 * @param rawInput - Tool parameters object
 * @returns Extracted content or undefined if not found
 */
export function extractContentFromParams(rawInput: Record<string, unknown>): string | undefined {
	for (const field of CONTENT_FIELDS) {
		const value = rawInput[field]
		if (typeof value === "string" && value.length > 0) {
			return value
		}
	}

	return undefined
}

// =============================================================================
// File Reading
// =============================================================================

/**
 * Resolve a file path to absolute, using workspace path if relative.
 * Includes path traversal protection when workspace path is provided.
 *
 * @param filePath - File path (may be relative or absolute)
 * @param workspacePath - Workspace path for resolving relative paths
 * @returns Result with absolute path, or error if path traversal detected
 */
export function resolveFilePath(filePath: string, workspacePath?: string): Result<string> {
	// Normalize the path to resolve any . or .. segments
	const normalizedPath = path.normalize(filePath)

	if (path.isAbsolute(normalizedPath)) {
		// For absolute paths with workspace, verify it's within workspace
		if (workspacePath) {
			const normalizedWorkspace = path.normalize(workspacePath)
			if (!normalizedPath.startsWith(normalizedWorkspace + path.sep) && normalizedPath !== normalizedWorkspace) {
				return err(`Path traversal detected: ${filePath} is outside workspace ${workspacePath}`)
			}
		}
		return ok(normalizedPath)
	}

	if (workspacePath) {
		const resolved = path.resolve(workspacePath, normalizedPath)
		const normalizedWorkspace = path.normalize(workspacePath)

		// Verify resolved path is within workspace (prevents ../../../etc/passwd attacks)
		if (!resolved.startsWith(normalizedWorkspace + path.sep) && resolved !== normalizedWorkspace) {
			return err(`Path traversal detected: ${filePath} resolves outside workspace ${workspacePath}`)
		}

		return ok(resolved)
	}

	// Return as-is if no workspace path available
	return ok(normalizedPath)
}

/**
 * Resolve a file path to absolute (legacy version without Result wrapper).
 *
 * @deprecated Use resolveFilePath() with Result type for better error handling
 * @param filePath - File path (may be relative or absolute)
 * @param workspacePath - Workspace path for resolving relative paths
 * @returns Absolute path (returns original path on error)
 */
export function resolveFilePathUnsafe(filePath: string, workspacePath?: string): string {
	const result = resolveFilePath(filePath, workspacePath)
	return result.ok ? result.value : filePath
}

/**
 * Read file content from the filesystem (synchronous version).
 *
 * For readFile tools, the rawInput.content field contains the file PATH
 * (not the contents), so we need to read the actual file.
 *
 * @deprecated Use readFileContentAsync() for non-blocking I/O
 * @param rawInput - Tool parameters (must contain path or content with file path)
 * @param workspacePath - Workspace path for resolving relative paths
 * @returns Result with file content or error message
 */
export function readFileContent(rawInput: Record<string, unknown>, workspacePath: string): Result<string> {
	// The "content" field in readFile contains the absolute path
	const filePath = rawInput.content as string | undefined
	const relativePath = rawInput.path as string | undefined

	// Try absolute path first, then relative path
	let pathToRead: string | undefined
	if (filePath) {
		const resolved = resolveFilePath(filePath, workspacePath)
		if (!resolved.ok) return resolved
		pathToRead = resolved.value
	} else if (relativePath) {
		const resolved = resolveFilePath(relativePath, workspacePath)
		if (!resolved.ok) return resolved
		pathToRead = resolved.value
	}

	if (!pathToRead) {
		return err("readFile tool has no path")
	}

	try {
		const content = fs.readFileSync(pathToRead, "utf-8")
		return ok(content)
	} catch (error) {
		return err(`Failed to read file ${pathToRead}: ${error}`)
	}
}

/**
 * Read file content from the filesystem (asynchronous version).
 *
 * For readFile tools, the rawInput.content field contains the file PATH
 * (not the contents), so we need to read the actual file.
 *
 * @param rawInput - Tool parameters (must contain path or content with file path)
 * @param workspacePath - Workspace path for resolving relative paths
 * @returns Promise resolving to Result with file content or error message
 */
export async function readFileContentAsync(
	rawInput: Record<string, unknown>,
	workspacePath: string,
): Promise<Result<string>> {
	// The "content" field in readFile contains the absolute path
	const filePath = rawInput.content as string | undefined
	const relativePath = rawInput.path as string | undefined

	// Try absolute path first, then relative path
	let pathToRead: string | undefined
	if (filePath) {
		const resolved = resolveFilePath(filePath, workspacePath)
		if (!resolved.ok) return resolved
		pathToRead = resolved.value
	} else if (relativePath) {
		const resolved = resolveFilePath(relativePath, workspacePath)
		if (!resolved.ok) return resolved
		pathToRead = resolved.value
	}

	if (!pathToRead) {
		return err("readFile tool has no path")
	}

	try {
		const content = await fsPromises.readFile(pathToRead, "utf-8")
		return ok(content)
	} catch (error) {
		return err(`Failed to read file ${pathToRead}: ${error}`)
	}
}

// =============================================================================
// User Echo Detection
// =============================================================================

/**
 * Check if a text message is an echo of the user's prompt.
 *
 * When the extension starts processing a task, it often sends a `text`
 * message containing the user's input. Since the ACP client already
 * displays the user's message, we should filter this out.
 *
 * Uses fuzzy matching to handle minor differences (whitespace, etc.).
 *
 * @param text - The text to check
 * @param promptText - The original prompt text to compare against
 * @returns true if the text appears to be an echo of the prompt
 */
export function isUserEcho(text: string, promptText: string | null): boolean {
	if (!promptText) {
		return false
	}

	// Normalize both strings for comparison
	const normalizedPrompt = promptText.trim().toLowerCase()
	const normalizedText = text.trim().toLowerCase()

	// Exact match
	if (normalizedText === normalizedPrompt) {
		return true
	}

	// Check if text is contained in prompt (might be truncated)
	if (normalizedPrompt.includes(normalizedText) && normalizedText.length > 10) {
		return true
	}

	// Check if prompt is contained in text (might have wrapper)
	if (normalizedText.includes(normalizedPrompt) && normalizedPrompt.length > 10) {
		return true
	}

	return false
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a path looks like a valid file path (has extension).
 *
 * @param filePath - Path to check
 * @returns true if the path has a file extension
 */
export function hasValidFilePath(filePath: string): boolean {
	return /\.[a-zA-Z0-9]+$/.test(filePath)
}
