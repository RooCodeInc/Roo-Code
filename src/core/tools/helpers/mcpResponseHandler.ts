import * as fs from "fs/promises"
import * as path from "path"
import { Anthropic } from "@anthropic-ai/sdk"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@roo-code/types"

import { Task } from "../../task/Task"
import { countTokens } from "../../../utils/countTokens"
import { getModelMaxOutputTokens } from "../../../shared/api"

/**
 * Percentage of available context to use as budget for MCP responses.
 * Uses the same percentage as file reading for consistency.
 */
export const MCP_RESPONSE_BUDGET_PERCENT = 0.5

/**
 * Default number of preview lines to show when response is saved to file.
 */
export const DEFAULT_PREVIEW_LINES = 50

/**
 * Directory name for storing oversized MCP responses within .roo folder.
 */
export const MCP_RESPONSE_DIR = ".roo/tmp/mcp-responses"

export interface McpResponseHandlerResult {
	/** The content to include in the tool result (either full response or preview with file path) */
	content: string
	/** Whether the response was saved to a file */
	savedToFile: boolean
	/** Path to the saved file (if savedToFile is true) */
	filePath?: string
	/** Token count of the original response */
	originalTokenCount: number
	/** Token count of the content being returned */
	returnedTokenCount: number
}

export interface McpResponseHandlerOptions {
	/** Number of preview lines to show when response is saved to file (default: 50) */
	previewLines?: number
	/** Custom file name prefix for saved files */
	fileNamePrefix?: string
}

/**
 * Handles MCP responses by checking if they fit within the available context budget.
 * If the response is too large, it saves it to a file and returns a preview.
 *
 * This implements dynamic context management for MCP responses, similar to how
 * ReadFileTool handles large files.
 *
 * @param task - The current Task instance
 * @param response - The MCP response content
 * @param options - Optional configuration
 * @returns Result containing the content to use and metadata about the operation
 */
export async function handleMcpResponse(
	task: Task,
	response: string,
	options: McpResponseHandlerOptions = {},
): Promise<McpResponseHandlerResult> {
	const { previewLines = DEFAULT_PREVIEW_LINES, fileNamePrefix = "mcp-response" } = options

	// Get model info and calculate available context budget
	const { id: modelId, info: modelInfo } = task.api.getModel()
	const { contextTokens } = task.getTokenUsage()
	const contextWindow = modelInfo.contextWindow

	const maxOutputTokens =
		getModelMaxOutputTokens({
			modelId,
			model: modelInfo,
			settings: task.apiConfiguration,
		}) ?? ANTHROPIC_DEFAULT_MAX_TOKENS

	// Calculate available token budget for MCP response
	const remainingTokens = contextWindow - maxOutputTokens - (contextTokens || 0)
	const mcpResponseBudget = Math.floor(remainingTokens * MCP_RESPONSE_BUDGET_PERCENT)

	// Count tokens in the response
	const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: response }]
	let responseTokens: number
	try {
		responseTokens = await countTokens(contentBlocks, { useWorker: false })
	} catch {
		// Fallback: conservative estimate (2 chars per token)
		responseTokens = Math.ceil(response.length / 2)
	}

	// If response fits within budget, return it directly
	if (responseTokens <= mcpResponseBudget && mcpResponseBudget > 0) {
		return {
			content: response,
			savedToFile: false,
			originalTokenCount: responseTokens,
			returnedTokenCount: responseTokens,
		}
	}

	// Response is too large - save to file and return preview
	const filePath = await saveResponseToFile(task.cwd, response, fileNamePrefix)
	const preview = generatePreview(response, previewLines)

	// Count tokens in preview content
	let previewTokens: number
	try {
		const previewBlocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: preview }]
		previewTokens = await countTokens(previewBlocks, { useWorker: false })
	} catch {
		previewTokens = Math.ceil(preview.length / 2)
	}

	// Build the response with file reference and preview
	const relativePath = path.relative(task.cwd, filePath)
	const resultContent = formatOversizedResponse(relativePath, response.length, responseTokens, preview)

	return {
		content: resultContent,
		savedToFile: true,
		filePath: relativePath,
		originalTokenCount: responseTokens,
		returnedTokenCount: previewTokens,
	}
}

/**
 * Saves the MCP response to a file in the .roo/tmp/mcp-responses directory.
 *
 * @param cwd - Current working directory
 * @param content - Content to save
 * @param prefix - File name prefix
 * @returns Absolute path to the saved file
 */
async function saveResponseToFile(cwd: string, content: string, prefix: string): Promise<string> {
	const responseDir = path.join(cwd, MCP_RESPONSE_DIR)

	// Ensure directory exists
	await fs.mkdir(responseDir, { recursive: true })

	// Generate unique filename with timestamp
	const timestamp = Date.now()
	const randomSuffix = Math.random().toString(36).substring(2, 8)
	const fileName = `${prefix}-${timestamp}-${randomSuffix}.txt`
	const filePath = path.join(responseDir, fileName)

	// Write content to file
	await fs.writeFile(filePath, content, "utf-8")

	return filePath
}

/**
 * Generates a preview of the response content.
 *
 * @param content - Full response content
 * @param maxLines - Maximum number of lines to include in preview
 * @returns Preview string
 */
function generatePreview(content: string, maxLines: number): string {
	const lines = content.split("\n")
	if (lines.length <= maxLines) {
		return content
	}

	const previewLines = lines.slice(0, maxLines)
	return previewLines.join("\n")
}

/**
 * Formats the response when it's been saved to a file.
 *
 * @param filePath - Relative path to saved file
 * @param contentLength - Length of original content in characters
 * @param tokenCount - Token count of original content
 * @param preview - Preview of the content
 * @returns Formatted response string
 */
function formatOversizedResponse(
	filePath: string,
	contentLength: number,
	tokenCount: number,
	preview: string,
): string {
	return `[MCP Response Saved to File]
The MCP response was too large to include in context (${tokenCount.toLocaleString()} tokens, ${contentLength.toLocaleString()} characters).
The full response has been saved to: ${filePath}

You can read the complete response using the read_file tool with the path above.

Preview (first ${DEFAULT_PREVIEW_LINES} lines):
---
${preview}
---

Suggested actions:
- Use read_file with line_range to read specific sections of the file
- Process the data using bash/python scripts if needed for analysis
- Extract specific information by reading relevant portions`
}

/**
 * Calculates the available context budget for MCP responses.
 * Useful for pre-checks or logging.
 *
 * @param task - The current Task instance
 * @returns Available token budget for MCP responses
 */
export function getAvailableMcpResponseBudget(task: Task): number {
	const { id: modelId, info: modelInfo } = task.api.getModel()
	const { contextTokens } = task.getTokenUsage()
	const contextWindow = modelInfo.contextWindow

	const maxOutputTokens =
		getModelMaxOutputTokens({
			modelId,
			model: modelInfo,
			settings: task.apiConfiguration,
		}) ?? ANTHROPIC_DEFAULT_MAX_TOKENS

	const remainingTokens = contextWindow - maxOutputTokens - (contextTokens || 0)
	return Math.floor(remainingTokens * MCP_RESPONSE_BUDGET_PERCENT)
}
