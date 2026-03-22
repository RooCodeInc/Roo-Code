// src/core/memory/preprocessor.ts
import type { PreprocessResult } from "./types"

// Tool names that produce filename references
const FILE_TOOLS = new Set(["read_file", "write_to_file", "apply_diff"])
const SEARCH_TOOLS = new Set(["search_files", "list_files"])

// Estimate tokens as ~4 chars per token (rough, fast)
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

function stripLongCodeBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, (match) => {
		const lines = match.split("\n")
		// Opening ``` + content lines + closing ```
		// Content lines = total - 2 (opening and closing ```)
		if (lines.length - 2 > 3) {
			return "[code block removed]"
		}
		return match
	})
}

function processUserContent(content: any): string {
	if (typeof content === "string") return content

	if (!Array.isArray(content)) return ""

	const parts: string[] = []
	for (const block of content) {
		if (block.type === "text") {
			parts.push(block.text)
		} else if (block.type === "image" || block.type === "image_url") {
			parts.push("[image attached]")
		}
	}
	return parts.join("\n")
}

function processAssistantContent(content: any): string {
	if (typeof content === "string") return stripLongCodeBlocks(content)

	if (!Array.isArray(content)) return ""

	const parts: string[] = []
	for (const block of content) {
		if (block.type === "text") {
			parts.push(stripLongCodeBlocks(block.text))
		} else if (block.type === "tool_use") {
			const name = block.name
			const input = block.input || {}
			if (FILE_TOOLS.has(name)) {
				parts.push(`→ ${name === "read_file" ? "read" : "edited"}: ${input.path || "unknown"}`)
			} else if (name === "execute_command") {
				parts.push(`→ ran command: ${input.command || "unknown"}`)
			} else if (SEARCH_TOOLS.has(name)) {
				parts.push(`→ searched: ${input.path || input.regex || "unknown"}`)
			}
			// All other tool_use blocks are stripped (no output)
		}
		// tool_result blocks are stripped entirely (no case for them)
	}
	return parts.join("\n")
}

export function preprocessMessages(messages: any[]): PreprocessResult {
	if (messages.length === 0) {
		return { cleaned: "", originalTokenEstimate: 0, cleanedTokenEstimate: 0 }
	}

	let originalText = ""
	const cleanedParts: string[] = []

	for (const msg of messages) {
		const role = msg.role
		const rawContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
		originalText += rawContent

		if (role === "user") {
			const processed = processUserContent(msg.content)
			if (processed.trim()) {
				cleanedParts.push(`User: ${processed.trim()}`)
			}
		} else if (role === "assistant") {
			const processed = processAssistantContent(msg.content)
			if (processed.trim()) {
				cleanedParts.push(`Assistant: ${processed.trim()}`)
			}
		}
	}

	const cleaned = cleanedParts.join("\n\n")
	return {
		cleaned,
		originalTokenEstimate: estimateTokens(originalText),
		cleanedTokenEstimate: estimateTokens(cleaned),
	}
}
