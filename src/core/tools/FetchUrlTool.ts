import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"

interface FetchUrlParams {
	url: string
	max_length?: number
}

const DEFAULT_MAX_LENGTH = 50_000
const FETCH_TIMEOUT_MS = 30_000

export class FetchUrlTool extends BaseTool<"fetch_url"> {
	readonly name = "fetch_url" as const

	async execute(params: FetchUrlParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { askApproval, handleError, pushToolResult } = callbacks
		const { url, max_length = DEFAULT_MAX_LENGTH } = params

		try {
			if (!url) {
				task.consecutiveMistakeCount++
				task.recordToolError("fetch_url")
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("fetch_url", "url"))
				return
			}

			// Validate URL
			let parsedUrl: URL
			try {
				parsedUrl = new URL(url)
			} catch {
				task.consecutiveMistakeCount++
				task.recordToolError("fetch_url")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError(`Invalid URL: ${url}`))
				return
			}

			// Only allow http/https
			if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
				task.consecutiveMistakeCount++
				task.recordToolError("fetch_url")
				task.didToolFailInCurrentTurn = true
				pushToolResult(formatResponse.toolError("Only HTTP and HTTPS URLs are supported."))
				return
			}

			task.consecutiveMistakeCount = 0

			const toolMessage = JSON.stringify({
				tool: "fetchUrl",
				url,
			})

			const didApprove = await askApproval("tool", toolMessage)
			if (!didApprove) {
				return
			}

			// Try using the existing UrlContentFetcher if available
			const content = await this.fetchContent(url, max_length)

			this._rpiObservationExtras = {
				summary: `Fetched URL: ${url} (${content.length} chars)`,
			}

			pushToolResult(content)
		} catch (error) {
			await handleError("fetching URL", error as Error)
		}
	}

	private async fetchContent(url: string, maxLength: number): Promise<string> {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

		try {
			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; RooCode/1.0; +https://github.com/RooCode)",
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
				},
				redirect: "follow",
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}

			const contentType = response.headers.get("content-type") ?? ""
			const isText =
				contentType.includes("text/") ||
				contentType.includes("application/json") ||
				contentType.includes("application/xml") ||
				contentType.includes("application/javascript")

			if (!isText) {
				return `[Binary content: ${contentType}] (${response.headers.get("content-length") ?? "unknown"} bytes)`
			}

			let text = await response.text()

			// Strip HTML tags for a cleaner text representation
			if (contentType.includes("text/html")) {
				text = this.stripHtml(text)
			}

			if (text.length > maxLength) {
				text = text.slice(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`
			}

			return text
		} finally {
			clearTimeout(timeout)
		}
	}

	private stripHtml(html: string): string {
		// Remove script and style content
		let text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
		text = text.replace(/<style[\s\S]*?<\/style>/gi, "")
		// Remove HTML tags
		text = text.replace(/<[^>]+>/g, " ")
		// Decode common HTML entities
		text = text.replace(/&amp;/g, "&")
		text = text.replace(/&lt;/g, "<")
		text = text.replace(/&gt;/g, ">")
		text = text.replace(/&quot;/g, '"')
		text = text.replace(/&#39;/g, "'")
		text = text.replace(/&nbsp;/g, " ")
		// Clean up whitespace
		text = text.replace(/\s+/g, " ").trim()
		return text
	}

	override async handlePartial(task: Task, block: ToolUse<"fetch_url">): Promise<void> {
		const url = block.params.url
		if (url) {
			const toolMessage = JSON.stringify({ tool: "fetchUrl", url })
			await task.ask("tool", toolMessage, block.partial).catch(() => {})
		}
	}
}

export const fetchUrlTool = new FetchUrlTool()
