import os from "os"
import * as path from "path"
import * as vscode from "vscode"

import type { NeutralContentBlock, NeutralMessageParam, ReasoningPart } from "../../core/task-persistence"

// Extended content block types to support new Anthropic API features

interface ThoughtSignatureBlock {
	type: "thoughtSignature"
}

export type ExtendedContentBlock = NeutralContentBlock | ReasoningPart | ThoughtSignatureBlock

export function getTaskFileName(dateTs: number): string {
	const date = new Date(dateTs)
	const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase()
	const day = date.getDate()
	const year = date.getFullYear()
	let hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const seconds = date.getSeconds().toString().padStart(2, "0")
	const ampm = hours >= 12 ? "pm" : "am"
	hours = hours % 12
	hours = hours ? hours : 12 // the hour '0' should be '12'
	return `roo_task_${month}-${day}-${year}_${hours}-${minutes}-${seconds}-${ampm}.md`
}

export async function downloadTask(
	dateTs: number,
	conversationHistory: NeutralMessageParam[],
	defaultUri: vscode.Uri,
): Promise<vscode.Uri | undefined> {
	// File name
	const fileName = getTaskFileName(dateTs)

	// Generate markdown
	const markdownContent = conversationHistory
		.map((message) => {
			const role = message.role === "user" ? "**User:**" : "**Assistant:**"
			const content = Array.isArray(message.content)
				? message.content.map((block) => formatContentBlockToMarkdown(block as ExtendedContentBlock)).join("\n")
				: message.content
			return `${role}\n\n${content}\n\n`
		})
		.join("---\n\n")

	// Prompt user for save location
	const saveUri = await vscode.window.showSaveDialog({
		filters: { Markdown: ["md"] },
		defaultUri,
	})

	if (saveUri) {
		// Write content to the selected location
		await vscode.workspace.fs.writeFile(saveUri, Buffer.from(markdownContent))
		vscode.window.showTextDocument(saveUri, { preview: true })
		return saveUri
	}
	return undefined
}

export function formatContentBlockToMarkdown(block: ExtendedContentBlock): string {
	switch (block.type) {
		case "text":
			return block.text
		case "image":
			return `[Image]`
		case "tool-call": {
			let inputStr: string
			if (typeof block.input === "object" && block.input !== null) {
				inputStr = Object.entries(block.input as Record<string, unknown>)
					.map(([key, value]) => {
						const formattedKey = key.charAt(0).toUpperCase() + key.slice(1)
						// Handle nested objects/arrays by JSON stringifying them
						const formattedValue =
							typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)
						return `${formattedKey}: ${formattedValue}`
					})
					.join("\n")
			} else {
				inputStr = String(block.input)
			}
			return `[Tool Use: ${block.toolName}]\n${inputStr}`
		}
		case "tool-result": {
			const toolName = block.toolName || "Tool"
			const isError = block.output?.type === "error-text" || block.output?.type === "error-json"
			const errorSuffix = isError ? " (Error)" : ""
			if (block.output?.type === "text" || block.output?.type === "error-text") {
				return `[${toolName}${errorSuffix}]\n${block.output.value}`
			} else if (block.output?.type === "content") {
				return `[${toolName}${errorSuffix}]\n${(block.output.value as Array<any>)
					.map((contentBlock: any) => formatContentBlockToMarkdown(contentBlock))
					.join("\n")}`
			} else {
				return `[${toolName}${errorSuffix}]`
			}
		}
		case "reasoning":
			return `[Reasoning]\n${block.text}`
		case "thoughtSignature":
			// Not relevant for human-readable exports
			return ""
		default:
			return `[Unexpected content type: ${block.type}]`
	}
}

export function findToolName(toolCallId: string, messages: NeutralMessageParam[]): string {
	for (const message of messages) {
		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool-call" && block.toolCallId === toolCallId) {
					return block.toolName
				}
			}
		}
	}
	return "Unknown Tool"
}
