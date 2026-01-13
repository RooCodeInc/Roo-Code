import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { t } from "../../i18n"

export interface WebSearchParams {
	query: string
}

// Mock search results for demonstration
// In a real implementation, this would integrate with a search API like:
// - Brave Search API
// - Google Custom Search API
// - Bing Search API
// - DuckDuckGo API
// - Or use an MCP server like Perplexity
const mockSearchResults = [
	{
		title: "Getting started with web development",
		url: "https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web",
		snippet:
			"Learn the basics of web development including HTML, CSS, and JavaScript. This comprehensive guide covers everything you need to know to start building websites.",
	},
	{
		title: "Web Development Best Practices",
		url: "https://web.dev/learn",
		snippet:
			"Modern web development best practices including performance optimization, accessibility, SEO, and progressive web apps. Learn how to build fast, reliable web experiences.",
	},
	{
		title: "JavaScript Documentation",
		url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
		snippet:
			"Comprehensive JavaScript documentation covering core language features, APIs, and best practices for modern web development.",
	},
]

export class WebSearchTool extends BaseTool<"web_search"> {
	readonly name = "web_search" as const

	parseLegacy(params: Partial<Record<string, string>>): WebSearchParams {
		return {
			query: params.query || "",
		}
	}

	async execute(params: WebSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { query } = params
		const { handleError, pushToolResult, askApproval, removeClosingTag } = callbacks

		if (!query) {
			task.consecutiveMistakeCount++
			task.recordToolError("web_search")
			pushToolResult(await task.sayAndCreateMissingParamError("web_search", "query"))
			return
		}

		try {
			task.consecutiveMistakeCount = 0

			// Ask for approval before performing the search
			const approvalMessage = JSON.stringify({
				tool: "webSearch",
				query: removeClosingTag("query", query),
			})

			const didApprove = await askApproval("tool", approvalMessage)

			if (!didApprove) {
				return
			}

			// Log the search query
			await task.say("text", t("tools:webSearch.searching", { query }))

			// In a real implementation, this would call an actual search API
			// For now, we'll return mock results to demonstrate the functionality
			// This allows the tool to work without requiring additional API keys or setup

			// Simulate API delay
			await new Promise((resolve) => setTimeout(resolve, 500))

			// Format the search results
			let resultText = t("tools:webSearch.results", { query }) + "\n\n"

			mockSearchResults.forEach((result, index) => {
				resultText += `${index + 1}. **${result.title}**\n`
				resultText += `   URL: ${result.url}\n`
				resultText += `   ${result.snippet}\n\n`
			})

			resultText += t("tools:webSearch.mockNote")

			// Record successful tool usage
			task.recordToolUsage("web_search")

			// Return the search results
			pushToolResult(formatResponse.toolResult(resultText))
		} catch (error) {
			await handleError("performing web search", error as Error)
			task.recordToolError("web_search")
			return
		}
	}

	override async handlePartial(task: Task, block: any): Promise<void> {
		return
	}
}

export const webSearchTool = new WebSearchTool()
