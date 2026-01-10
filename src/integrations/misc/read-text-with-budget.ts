import { Anthropic } from "@anthropic-ai/sdk"

import { countTokens } from "../../utils/countTokens"

export interface ReadTextWithBudgetResult {
	/** The content read up to the token budget */
	content: string
	/** Actual token count of returned content */
	tokenCount: number
	/** Total lines in the returned content */
	lineCount: number
	/** Whether the entire text was read (false if truncated) */
	complete: boolean
}

export interface ReadTextWithBudgetOptions {
	/** Maximum tokens allowed. Required. */
	budgetTokens: number
	/** Number of lines to buffer before token counting (default: 256) */
	chunkLines?: number
}

function normalizeTextToLines(text: string): string[] {
	// Normalize line endings and mirror `readFileWithTokenBudget()` behavior:
	// - split on line boundaries
	// - do not include a trailing empty line caused solely by a trailing newline
	const lines = text.split(/\r?\n/)
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop()
	}
	return lines
}

async function countTextTokens(text: string): Promise<number> {
	try {
		const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text }]
		return await countTokens(contentBlocks)
	} catch {
		// Fallback: conservative estimate (2 chars per token)
		return Math.ceil(text.length / 2)
	}
}

/**
 * Reads text while incrementally counting tokens, stopping when budget is reached.
 *
 * This is the in-memory analogue of [`readFileWithTokenBudget()`](src/integrations/misc/read-file-with-budget.ts:35).
 */
export async function readTextWithTokenBudget(
	text: string,
	options: ReadTextWithBudgetOptions,
): Promise<ReadTextWithBudgetResult> {
	const { budgetTokens, chunkLines = 256 } = options

	const allLines = normalizeTextToLines(text)
	if (allLines.length === 0) {
		return { content: "", tokenCount: 0, lineCount: 0, complete: true }
	}

	let content = ""
	let lineCount = 0
	let tokenCount = 0
	let complete = true
	let lineBuffer: string[] = []

	const processBuffer = async (): Promise<boolean> => {
		if (lineBuffer.length === 0) return true

		const bufferText = lineBuffer.join("\n")
		const currentBuffer = [...lineBuffer]
		lineBuffer = []

		const chunkTokens = await countTextTokens(bufferText)

		if (tokenCount + chunkTokens > budgetTokens) {
			// Find cutoff within this chunk (binary search by line count)
			let low = 0
			let high = currentBuffer.length
			let bestFit = 0
			let bestTokens = 0

			while (low < high) {
				const mid = Math.floor((low + high + 1) / 2)
				const testContent = currentBuffer.slice(0, mid).join("\n")
				const testTokens = await countTextTokens(testContent)

				if (tokenCount + testTokens <= budgetTokens) {
					bestFit = mid
					bestTokens = testTokens
					low = mid
				} else {
					high = mid - 1
				}
			}

			if (bestFit > 0) {
				const fitContent = currentBuffer.slice(0, bestFit).join("\n")
				content += (content.length > 0 ? "\n" : "") + fitContent
				tokenCount += bestTokens
				lineCount += bestFit
			}

			complete = false
			return false
		}

		content += (content.length > 0 ? "\n" : "") + bufferText
		tokenCount += chunkTokens
		lineCount += currentBuffer.length
		return true
	}

	for (const line of allLines) {
		lineBuffer.push(line)
		if (lineBuffer.length >= chunkLines) {
			const continueReading = await processBuffer()
			if (!continueReading) {
				return { content, tokenCount, lineCount, complete }
			}
		}
	}

	if (lineBuffer.length > 0) {
		await processBuffer()
	}

	return { content, tokenCount, lineCount, complete }
}
