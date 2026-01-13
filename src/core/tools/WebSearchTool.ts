import { type ClineSayTool } from "@roo-code/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import type { ToolUse } from "../../shared/tools"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface WebSearchParams {
	query: string
	max_results?: number | null
}

type WebSearchResult = {
	title: string
	url: string
	snippet?: string
}

const DEFAULT_MAX_RESULTS = 5
const MAX_RESULTS_LIMIT = 10
const WEB_SEARCH_TIMEOUT_MS = 15000

function normalizeMaxResults(value?: number | null): number {
	if (!value || Number.isNaN(value)) {
		return DEFAULT_MAX_RESULTS
	}
	return Math.min(Math.max(Math.trunc(value), 1), MAX_RESULTS_LIMIT)
}

function formatWebSearchResults(query: string, results: WebSearchResult[]): string {
	if (results.length === 0) {
		return `No web results found for "${query}".`
	}

	const lines = results.map((result, index) => {
		const header = `${index + 1}. ${result.title}`
		const snippet = result.snippet ? `\n${result.snippet}` : ""
		return `${header}\n${result.url}${snippet}`
	})

	return `Web search results for "${query}":\n\n${lines.join("\n\n")}`
}

function splitTextSnippet(text?: string): { title: string; snippet?: string } {
	if (!text) {
		return { title: "Untitled result" }
	}

	const [title, ...rest] = text.split(" - ")
	const snippet = rest.length > 0 ? rest.join(" - ") : undefined
	return { title: title.trim() || "Untitled result", snippet: snippet?.trim() || undefined }
}

function extractResults(payload: any, maxResults: number): WebSearchResult[] {
	const results: WebSearchResult[] = []

	if (payload?.AbstractURL && payload?.AbstractText) {
		results.push({
			title: payload.Heading || payload.AbstractText,
			url: payload.AbstractURL,
			snippet: payload.AbstractText,
		})
	}

	const directResults: any[] = Array.isArray(payload?.Results) ? payload.Results : []
	for (const result of directResults) {
		if (!result?.FirstURL || !result?.Text) {
			continue
		}
		const { title, snippet } = splitTextSnippet(result.Text)
		results.push({
			title,
			url: result.FirstURL,
			snippet,
		})
	}

	const relatedTopics: any[] = Array.isArray(payload?.RelatedTopics) ? payload.RelatedTopics : []
	const queue = [...relatedTopics]
	while (queue.length > 0) {
		const topic = queue.shift()
		if (!topic) {
			continue
		}
		if (Array.isArray(topic.Topics)) {
			queue.push(...topic.Topics)
			continue
		}
		if (!topic.FirstURL || !topic.Text) {
			continue
		}
		const { title, snippet } = splitTextSnippet(topic.Text)
		results.push({
			title,
			url: topic.FirstURL,
			snippet,
		})
	}

	return results.slice(0, maxResults)
}

export class WebSearchTool extends BaseTool<"web_search"> {
	readonly name = "web_search" as const

	parseLegacy(params: Partial<Record<string, string>>): WebSearchParams {
		const maxResults = params.max_results ? Number.parseInt(params.max_results, 10) : undefined

		return {
			query: params.query || "",
			max_results: Number.isNaN(maxResults) ? undefined : maxResults,
		}
	}

	async execute(params: WebSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult, toolProtocol } = callbacks
		const query = params.query

		if (!query) {
			task.consecutiveMistakeCount++
			task.recordToolError("web_search")
			task.didToolFailInCurrentTurn = true
			pushToolResult(await task.sayAndCreateMissingParamError("web_search", "query"))
			return
		}

		const maxResults = normalizeMaxResults(params.max_results)

		try {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), WEB_SEARCH_TIMEOUT_MS)
			try {
				const url = new URL("https://api.duckduckgo.com/")
				url.searchParams.set("q", query)
				url.searchParams.set("format", "json")
				url.searchParams.set("no_html", "1")
				url.searchParams.set("skip_disambig", "1")

				const response = await fetch(url.toString(), {
					signal: controller.signal,
					headers: {
						"User-Agent": "RooCode-WebSearch",
					},
				})

				if (!response.ok) {
					throw new Error(`Web search request failed with status ${response.status}`)
				}

				const payload = await response.json()
				const results = extractResults(payload, maxResults)
				const displayContent = formatWebSearchResults(query, results)

				const sharedMessageProps: ClineSayTool = {
					tool: "webSearch",
					query,
					content: displayContent,
				}

				const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
				if (!didApprove) {
					pushToolResult(formatResponse.toolDenied(toolProtocol))
					return
				}

				task.consecutiveMistakeCount = 0
				pushToolResult(JSON.stringify({ query, source: "duckduckgo", results }, null, 2))
			} finally {
				clearTimeout(timeoutId)
			}
		} catch (error) {
			await handleError("web_search", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"web_search">): Promise<void> {
		const query = block.params.query
		const maxResults = block.params.max_results

		const sharedMessageProps: ClineSayTool = {
			tool: "webSearch",
			query: this.removeClosingTag("query", query, block.partial),
			content: "",
		}

		if (maxResults) {
			sharedMessageProps.content = `Results requested: ${this.removeClosingTag("max_results", maxResults, block.partial)}`
		}

		await task.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
	}
}

export const webSearchTool = new WebSearchTool()
