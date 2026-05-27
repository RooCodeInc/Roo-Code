import axios from "axios"
import * as cheerio from "cheerio"

const MAX_CONTENT_LENGTH = 50_000
const REQUEST_TIMEOUT_MS = 15_000

export interface FetchUrlResult {
	url: string
	content: string
	truncated: boolean
}

/**
 * Fetches a URL and extracts readable text content from the HTML.
 * Uses cheerio for HTML parsing and text extraction.
 * Falls back to raw text for non-HTML responses.
 */
export async function fetchUrlContent(url: string): Promise<FetchUrlResult> {
	const response = await axios.get(url, {
		timeout: REQUEST_TIMEOUT_MS,
		maxRedirects: 5,
		responseType: "text",
		headers: {
			"User-Agent": "Roo-Code/1.0 (URL Context Fetcher)",
			Accept: "text/html, application/xhtml+xml, text/plain, */*",
		},
		// Limit response size to avoid downloading huge files
		maxContentLength: 5 * 1024 * 1024, // 5MB
	})

	const contentType = response.headers["content-type"] || ""
	const rawBody = typeof response.data === "string" ? response.data : String(response.data)

	let text: string

	if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
		text = extractTextFromHtml(rawBody)
	} else {
		// For non-HTML content (plain text, JSON, etc.), use raw body
		text = rawBody
	}

	const truncated = text.length > MAX_CONTENT_LENGTH
	if (truncated) {
		text = text.slice(0, MAX_CONTENT_LENGTH)
	}

	return { url, content: text, truncated }
}

/**
 * Extracts meaningful text content from an HTML string using cheerio.
 * Removes scripts, styles, navigation, and other non-content elements.
 */
function extractTextFromHtml(html: string): string {
	const $ = cheerio.load(html)

	// Remove non-content elements
	$(
		"script, style, nav, footer, header, noscript, svg, iframe, form, button, [role='navigation'], [role='banner'], [role='contentinfo'], [aria-hidden='true']",
	).remove()

	// Try to find main content area first
	let contentEl = $("main, article, [role='main'], .content, #content, .post, .article")
	if (contentEl.length === 0) {
		contentEl = $("body")
	}

	// Extract text, preserving some structure
	const text = contentEl
		.text()
		.replace(/[ \t]+/g, " ") // Collapse horizontal whitespace
		.replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines
		.trim()

	return text
}
