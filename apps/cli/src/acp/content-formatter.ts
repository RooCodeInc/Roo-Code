/**
 * Content Formatter
 *
 * Provides content formatting for ACP UI display.
 *
 * This module offers two usage patterns:
 *
 * 1. **Direct function imports** (preferred for simple use cases):
 *    ```ts
 *    import { formatSearchResults, wrapInCodeBlock } from './content-formatter.js'
 *    const formatted = wrapInCodeBlock(formatSearchResults(content))
 *    ```
 *
 * 2. **Class-based DI** (for dependency injection in tests):
 *    ```ts
 *    import { ContentFormatter, type IContentFormatter } from './content-formatter.js'
 *    const formatter: IContentFormatter = new ContentFormatter()
 *    ```
 */

import type { IContentFormatter } from "./interfaces.js"
import {
	formatSearchResults,
	formatReadContent,
	wrapInCodeBlock,
	isUserEcho,
	readFileContent,
	readFileContentAsync,
	extractContentFromParams,
	type FormatConfig,
	DEFAULT_FORMAT_CONFIG,
} from "./utils/index.js"
import { acpLog } from "./logger.js"

// =============================================================================
// Direct Exports (Preferred)
// =============================================================================

// Re-export utility functions for direct use
export { formatSearchResults, formatReadContent, wrapInCodeBlock, isUserEcho }

// =============================================================================
// Tool Result Formatting
// =============================================================================

/**
 * Format tool result content based on the tool kind.
 *
 * Applies appropriate formatting (search summary, truncation, code blocks)
 * based on the tool type.
 *
 * @param kind - The tool kind (search, read, etc.)
 * @param content - The raw content to format
 * @param config - Optional formatting configuration
 * @returns Formatted content
 */
export function formatToolResult(kind: string, content: string, config: FormatConfig = DEFAULT_FORMAT_CONFIG): string {
	switch (kind) {
		case "search":
			return wrapInCodeBlock(formatSearchResults(content))
		case "read":
			return wrapInCodeBlock(formatReadContent(content, config))
		default:
			return content
	}
}

/**
 * Extract file content for readFile operations.
 *
 * For readFile tools, the rawInput.content field contains the file PATH
 * (not the contents), so we need to read the actual file.
 *
 * @param rawInput - Tool parameters
 * @param workspacePath - Workspace path for resolving relative paths
 * @returns File content or error message, or undefined if no path
 */
export function extractFileContent(rawInput: Record<string, unknown>, workspacePath: string): string | undefined {
	const toolName = (rawInput.tool as string | undefined)?.toLowerCase() || ""

	// Only read file content for readFile tools
	if (toolName !== "readfile" && toolName !== "read_file") {
		return extractContentFromParams(rawInput)
	}

	// Check if we have a path before attempting to read
	const filePath = rawInput.content as string | undefined
	const relativePath = rawInput.path as string | undefined
	if (!filePath && !relativePath) {
		acpLog.warn("ContentFormatter", "readFile tool has no path")
		return undefined
	}

	const result = readFileContent(rawInput, workspacePath)
	if (result.ok) {
		acpLog.debug("ContentFormatter", `Read file content: ${result.value.length} chars`)
		return result.value
	} else {
		acpLog.error("ContentFormatter", result.error)
		return `Error reading file: ${result.error}`
	}
}

/**
 * Extract file content asynchronously for readFile operations.
 *
 * @param rawInput - Tool parameters
 * @param workspacePath - Workspace path for resolving relative paths
 * @returns Promise with file content or error message
 */
export async function extractFileContentAsync(
	rawInput: Record<string, unknown>,
	workspacePath: string,
): Promise<string | undefined> {
	const toolName = (rawInput.tool as string | undefined)?.toLowerCase() || ""

	// Only read file content for readFile tools
	if (toolName !== "readfile" && toolName !== "read_file") {
		return extractContentFromParams(rawInput)
	}

	// Check if we have a path before attempting to read
	const filePath = rawInput.content as string | undefined
	const relativePath = rawInput.path as string | undefined
	if (!filePath && !relativePath) {
		acpLog.warn("ContentFormatter", "readFile tool has no path")
		return undefined
	}

	const result = await readFileContentAsync(rawInput, workspacePath)
	if (result.ok) {
		acpLog.debug("ContentFormatter", `Read file content: ${result.value.length} chars`)
		return result.value
	} else {
		acpLog.error("ContentFormatter", result.error)
		return `Error reading file: ${result.error}`
	}
}

// =============================================================================
// ContentFormatter Class (for DI)
// =============================================================================

/**
 * Formats content for display in the ACP client UI.
 *
 * Implements IContentFormatter interface for dependency injection.
 * For simple use cases, prefer the direct function exports above.
 *
 * @example
 * ```ts
 * // In production code
 * const formatter = new ContentFormatter()
 *
 * // In tests with mock
 * const mockFormatter: IContentFormatter = {
 *   formatToolResult: vi.fn(),
 *   // ...
 * }
 * ```
 */
export class ContentFormatter implements IContentFormatter {
	private readonly config: FormatConfig

	constructor(config?: Partial<FormatConfig>) {
		this.config = { ...DEFAULT_FORMAT_CONFIG, ...config }
	}

	formatToolResult(kind: string, content: string): string {
		return formatToolResult(kind, content, this.config)
	}

	formatSearchResults(content: string): string {
		return formatSearchResults(content)
	}

	formatReadResults(content: string): string {
		return formatReadContent(content, this.config)
	}

	wrapInCodeBlock(content: string, language?: string): string {
		return wrapInCodeBlock(content, language)
	}

	isUserEcho(text: string, promptText: string | null): boolean {
		return isUserEcho(text, promptText)
	}

	/**
	 * Extract content from rawInput parameters.
	 * Tries common field names for content.
	 */
	extractContentFromRawInput(rawInput: Record<string, unknown>): string | undefined {
		return extractContentFromParams(rawInput)
	}

	/**
	 * Extract file content for readFile operations.
	 * Delegates to the standalone extractFileContent function.
	 */
	extractFileContent(rawInput: Record<string, unknown>, workspacePath: string): string | undefined {
		return extractFileContent(rawInput, workspacePath)
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new content formatter with optional configuration.
 */
export function createContentFormatter(config?: Partial<FormatConfig>): ContentFormatter {
	return new ContentFormatter(config)
}

// =============================================================================
// Type Exports
// =============================================================================

export type { FormatConfig as ContentFormatterConfig }
