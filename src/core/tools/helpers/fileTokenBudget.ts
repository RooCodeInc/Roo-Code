import * as fs from "fs/promises"
import { countTokens } from "../../../utils/countTokens"
import { Anthropic } from "@anthropic-ai/sdk"

/**
 * File size threshold (in bytes) above which token validation is triggered.
 * Files smaller than this are read without token counting overhead.
 */
export const FILE_SIZE_THRESHOLD = 100_000 // 100KB

/**
 * Absolute maximum file size (in bytes) that will be read for token validation.
 * Files larger than this cannot be tokenized due to tokenizer limitations.
 * This prevents WASM "unreachable" errors in tiktoken.
 */
export const MAX_FILE_SIZE_FOR_TOKENIZATION = 5_000_000 // 5MB

/**
 * Size of preview to read from files that exceed MAX_FILE_SIZE_FOR_TOKENIZATION.
 * This allows the agent to see the beginning of large files without crashing.
 */
export const PREVIEW_SIZE_FOR_LARGE_FILES = 100_000 // 100KB

/**
 * Percentage of available context to reserve for file reading.
 * The remaining percentage is reserved for the model's response and overhead.
 */
export const FILE_READ_BUDGET_PERCENT = 0.6 // 60% for file, 40% for response

/**
 * Result of token budget validation for a file.
 */
export interface TokenBudgetResult {
	/** Whether the file content should be truncated */
	shouldTruncate: boolean
	/** The maximum number of characters allowed (only relevant if shouldTruncate is true) */
	maxChars?: number
	/** Human-readable reason for truncation */
	reason?: string
	/** Whether this is a preview of a larger file (only showing beginning) */
	isPreview?: boolean
}

/**
 * Validates whether a file's content fits within the available token budget.
 *
 * Strategy:
 * 1. Files < 100KB: Skip validation (fast path)
 * 2. Files >= 100KB: Count tokens and check against budget
 * 3. Budget = (contextWindow - currentTokens) * 0.6
 *
 * @param filePath - Path to the file to validate
 * @param contextWindow - Total context window size in tokens
 * @param currentTokens - Current token usage
 * @returns TokenBudgetResult indicating whether to truncate and at what character limit
 */
export async function validateFileTokenBudget(
	filePath: string,
	contextWindow: number,
	currentTokens: number,
): Promise<TokenBudgetResult> {
	try {
		// Check file size first (fast path)
		const stats = await fs.stat(filePath)
		const fileSizeBytes = stats.size

		// Fast path: small files always pass
		if (fileSizeBytes < FILE_SIZE_THRESHOLD) {
			return { shouldTruncate: false }
		}

		// Safety check: for files too large to tokenize, provide a preview instead
		// The tokenizer (tiktoken WASM) crashes with "unreachable" errors on very large files
		if (fileSizeBytes > MAX_FILE_SIZE_FOR_TOKENIZATION) {
			return {
				shouldTruncate: true,
				maxChars: PREVIEW_SIZE_FOR_LARGE_FILES,
				isPreview: true,
				reason: `File is too large (${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB) to read entirely. Showing preview of first ${(PREVIEW_SIZE_FOR_LARGE_FILES / 1024 / 1024).toFixed(1)}MB. Use line_range to read specific sections.`,
			}
		}

		// Calculate available token budget
		const remainingTokens = contextWindow - currentTokens
		const safeReadBudget = Math.floor(remainingTokens * FILE_READ_BUDGET_PERCENT)

		// If we don't have enough budget, truncate immediately without reading
		if (safeReadBudget <= 0) {
			return {
				shouldTruncate: true,
				maxChars: 0,
				reason: "No available context budget for file reading",
			}
		}

		// Read the entire file
		const content = await fs.readFile(filePath, "utf-8")

		// Count tokens in the content with error handling for tokenizer crashes
		let tokenCount: number
		try {
			const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: content }]
			tokenCount = await countTokens(contentBlocks)
		} catch (error) {
			// Catch tokenizer "unreachable" errors (WASM crashes on extremely large content)
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.includes("unreachable")) {
				// Tokenizer crashed - file is too large, provide preview instead
				return {
					shouldTruncate: true,
					maxChars: PREVIEW_SIZE_FOR_LARGE_FILES,
					isPreview: true,
					reason: `File content caused tokenizer error. Showing preview of first ${(PREVIEW_SIZE_FOR_LARGE_FILES / 1024).toFixed(0)}KB. Use line_range to read specific sections.`,
				}
			}
			// Re-throw other unexpected errors
			throw error
		}

		// Check if content exceeds budget
		if (tokenCount > safeReadBudget) {
			// Estimate character limit based on token budget
			// Use a conservative estimate: 1 token ≈ 3 characters
			const maxChars = Math.floor(safeReadBudget * 3)

			return {
				shouldTruncate: true,
				maxChars,
				reason: `File requires ${tokenCount} tokens but only ${safeReadBudget} tokens available in context budget`,
			}
		}

		// File fits within budget
		return { shouldTruncate: false }
	} catch (error) {
		// On error, be conservative and don't truncate
		// This allows the existing error handling to take over
		console.warn(`[fileTokenBudget] Error validating file ${filePath}:`, error)
		return { shouldTruncate: false }
	}
}

/**
 * Truncates file content to fit within the specified character limit.
 * Adds a notice message at the end to inform the user about truncation.
 *
 * @param content - The full file content
 * @param maxChars - Maximum number of characters to keep
 * @param totalChars - Total number of characters in the original file
 * @param isPreview - Whether this is a preview of a larger file (not token-budget limited)
 * @returns Object containing truncated content and a notice message
 */
export function truncateFileContent(
	content: string,
	maxChars: number,
	totalChars: number,
	isPreview: boolean = false,
): { content: string; notice: string } {
	const truncatedContent = content.slice(0, maxChars)

	const notice = isPreview
		? `Preview: Showing first ${(maxChars / 1024 / 1024).toFixed(1)}MB of ${(totalChars / 1024 / 1024).toFixed(2)}MB file. Use line_range to read specific sections.`
		: `File truncated to ${maxChars} of ${totalChars} characters due to context limitations. Use line_range to read specific sections if needed.`

	return {
		content: truncatedContent,
		notice,
	}
}
