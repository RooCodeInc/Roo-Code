import { type ClineSayTool } from "@roo-code/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface WebSearchParams {
	query: string
	allowed_domains?: string[]
	blocked_domains?: string[]
}

export class WebSearchTool extends BaseTool<"web_search"> {
	readonly name = "web_search" as const

	async execute(params: WebSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { handleError, pushToolResult, askApproval } = callbacks
		const { query, allowed_domains, blocked_domains } = params

		try {
			// Validate required parameters
			if (!query || query.trim().length < 2) {
				task.consecutiveMistakeCount++
				task.recordToolError("web_search")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("web_search", "query"))
				return
			}

			// Validate mutual exclusivity of domain filters
			if (allowed_domains && allowed_domains.length > 0 && blocked_domains && blocked_domains.length > 0) {
				task.consecutiveMistakeCount++
				task.recordToolError("web_search")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError("Cannot specify both allowed_domains and blocked_domains"))
				return
			}

			task.consecutiveMistakeCount = 0

			// Create message for approval
			const completeMessage = JSON.stringify({
				tool: "webSearch",
				path: query,
				content: `Searching for: ${query}`,
				operationIsLocatedInWorkspace: false,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Get CloudService and perform search
			const { CloudService } = await import("@roo-code/cloud")

			if (!CloudService.hasInstance()) {
				pushToolResult(formatResponse.toolError("Cloud service not available"))
				return
			}

			const cloudAPI = CloudService.instance.cloudAPI
			if (!cloudAPI) {
				pushToolResult(formatResponse.toolError("Cloud API not available"))
				return
			}

			// Execute the actual search
			const options: { allowed_domains?: string[]; blocked_domains?: string[] } = {}
			if (allowed_domains && allowed_domains.length > 0) {
				options.allowed_domains = allowed_domains
			}
			if (blocked_domains && blocked_domains.length > 0) {
				options.blocked_domains = blocked_domains
			}

			const searchResult = await cloudAPI.webSearch(query, options)

			// Format results for display
			const results = searchResult.results || []
			const resultCount = results.length

			let resultText = `Search completed (${resultCount} results found)`
			if (results.length > 0) {
				resultText += ":\n\n"
				results.forEach((result: { title: string; url: string }, index: number) => {
					resultText += `${index + 1}. ${result.title}\n   ${result.url}\n\n`
				})
			}

			pushToolResult(formatResponse.toolResult(resultText))
		} catch (error) {
			await handleError(
				"web search",
				error instanceof Error ? error : new Error(`Error performing web search: ${String(error)}`),
			)
		} finally {
			this.resetPartialState()
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"web_search">): Promise<void> {
		const query: string | undefined = block.params.query
		const sharedMessageProps: ClineSayTool = {
			tool: "webSearch",
			path: query ?? "",
			content: `Searching for: ${query ?? ""}`,
			operationIsLocatedInWorkspace: false,
		}

		const partialMessage = JSON.stringify(sharedMessageProps)
		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const webSearchTool = new WebSearchTool()
