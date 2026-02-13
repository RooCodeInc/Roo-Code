import * as vscode from "vscode"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"

interface WebSearchParams {
	query: string
	max_results?: number
	search_type?: "general" | "code" | "docs"
}

interface WebSearchResult {
	title: string
	url: string
	snippet: string
}

export class WebSearchTool extends BaseTool<"web_search"> {
	readonly name = "web_search" as const

	async execute(params: WebSearchParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { query, max_results = 5, search_type = "general" } = params

		try {
			if (!query) {
				task.consecutiveMistakeCount++
				task.recordToolError("web_search")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("web_search", "query"))
				return
			}

			task.consecutiveMistakeCount = 0

			const toolMessage = JSON.stringify({
				tool: "webSearch",
				query,
				max_results,
				search_type,
			})

			const didApprove = await askApproval("tool", toolMessage)
			if (!didApprove) {
				return
			}

			// Try to find a web search API configuration
			const provider = task.providerRef.deref()
			const config = provider ? await this.getSearchConfig(provider) : undefined

			let results: WebSearchResult[]
			if (config) {
				results = await this.executeSearch(query, max_results, search_type, config)
			} else {
				// Fallback: inform user no search backend is configured
				pushToolResult(
					formatResponse.toolError(
						"No web search backend configured. Configure a search API (Brave, Tavily, or SearXNG) in settings to enable web search.",
					),
				)
				return
			}

			this._rpiObservationExtras = {
				summary: `Web search for "${query}" returned ${results.length} results`,
				matchCount: results.length,
			}

			if (results.length === 0) {
				pushToolResult("No results found for the query.")
				return
			}

			const formatted = results
				.map((r, i) => `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`)
				.join("\n\n")

			pushToolResult(formatted)
		} catch (error) {
			await handleError("web search", error as Error)
		}
	}

	private async getSearchConfig(
		provider: any,
	): Promise<{ type: "brave" | "tavily" | "searxng"; apiKey?: string; baseUrl?: string } | undefined> {
		try {
			const state = await provider.getState()
			const experiments = state?.experiments ?? {}

			if (experiments.webSearchProvider === "brave" && experiments.braveApiKey) {
				return { type: "brave", apiKey: experiments.braveApiKey }
			}
			if (experiments.webSearchProvider === "tavily" && experiments.tavilyApiKey) {
				return { type: "tavily", apiKey: experiments.tavilyApiKey }
			}
			if (experiments.webSearchProvider === "searxng" && experiments.searxngBaseUrl) {
				return { type: "searxng", baseUrl: experiments.searxngBaseUrl }
			}

			// Also check VSCode settings as fallback
			const vscConfig = vscode.workspace.getConfiguration("roo-cline")
			const braveKey = vscConfig.get<string>("braveSearchApiKey")
			if (braveKey) {
				return { type: "brave", apiKey: braveKey }
			}
			const tavilyKey = vscConfig.get<string>("tavilySearchApiKey")
			if (tavilyKey) {
				return { type: "tavily", apiKey: tavilyKey }
			}
			const searxngUrl = vscConfig.get<string>("searxngBaseUrl")
			if (searxngUrl) {
				return { type: "searxng", baseUrl: searxngUrl }
			}

			return undefined
		} catch {
			return undefined
		}
	}

	private async executeSearch(
		query: string,
		maxResults: number,
		searchType: string,
		config: { type: string; apiKey?: string; baseUrl?: string },
	): Promise<WebSearchResult[]> {
		switch (config.type) {
			case "brave":
				return this.searchBrave(query, maxResults, config.apiKey!)
			case "tavily":
				return this.searchTavily(query, maxResults, searchType, config.apiKey!)
			case "searxng":
				return this.searchSearxng(query, maxResults, config.baseUrl!)
			default:
				return []
		}
	}

	private async searchBrave(query: string, maxResults: number, apiKey: string): Promise<WebSearchResult[]> {
		const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				"Accept-Encoding": "gzip",
				"X-Subscription-Token": apiKey,
			},
		})

		if (!response.ok) {
			throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`)
		}

		const data = (await response.json()) as any
		const results = data?.web?.results ?? []
		return results.slice(0, maxResults).map((r: any) => ({
			title: r.title ?? "",
			url: r.url ?? "",
			snippet: r.description ?? "",
		}))
	}

	private async searchTavily(
		query: string,
		maxResults: number,
		searchType: string,
		apiKey: string,
	): Promise<WebSearchResult[]> {
		const response = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_key: apiKey,
				query,
				max_results: maxResults,
				search_depth: searchType === "docs" ? "advanced" : "basic",
			}),
		})

		if (!response.ok) {
			throw new Error(`Tavily Search API error: ${response.status} ${response.statusText}`)
		}

		const data = (await response.json()) as any
		const results = data?.results ?? []
		return results.slice(0, maxResults).map((r: any) => ({
			title: r.title ?? "",
			url: r.url ?? "",
			snippet: r.content?.slice(0, 300) ?? "",
		}))
	}

	private async searchSearxng(query: string, maxResults: number, baseUrl: string): Promise<WebSearchResult[]> {
		const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&pageno=1`
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
		})

		if (!response.ok) {
			throw new Error(`SearXNG error: ${response.status} ${response.statusText}`)
		}

		const data = (await response.json()) as any
		const results = data?.results ?? []
		return results.slice(0, maxResults).map((r: any) => ({
			title: r.title ?? "",
			url: r.url ?? "",
			snippet: r.content?.slice(0, 300) ?? "",
		}))
	}
}

export const webSearchTool = new WebSearchTool()
