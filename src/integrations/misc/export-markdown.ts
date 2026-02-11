import { Anthropic } from "@anthropic-ai/sdk"
import os from "os"
import * as path from "path"
import * as vscode from "vscode"

import {
	type AnyToolCallBlock,
	type AnyToolResultBlock,
	isAnyToolCallBlock,
	isAnyToolResultBlock,
	getToolCallName,
	getToolCallInput,
	getToolResultContent,
	getToolResultIsError,
} from "../../core/task-persistence/rooMessage"

// Extended content block types to support new Anthropic API features
interface ReasoningBlock {
	type: "reasoning"
	text: string
}

interface ThoughtSignatureBlock {
	type: "thoughtSignature"
}

export type ExtendedContentBlock = Anthropic.Messages.ContentBlockParam | ReasoningBlock | ThoughtSignatureBlock

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
	conversationHistory: Anthropic.MessageParam[],
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
	// Handle AI SDK tool-call format (alongside legacy tool_use below)
	if (isAnyToolCallBlock(block as { type: string })) {
		const tcBlock = block as unknown as AnyToolCallBlock
		const name = getToolCallName(tcBlock)
		const rawInput = getToolCallInput(tcBlock)
		let input: string
		if (typeof rawInput === "object" && rawInput !== null) {
			input = Object.entries(rawInput)
				.map(([key, value]) => {
					const formattedKey = key.charAt(0).toUpperCase() + key.slice(1)
					const formattedValue =
						typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)
					return `${formattedKey}: ${formattedValue}`
				})
				.join("\n")
		} else {
			input = String(rawInput)
		}
		return `[Tool Use: ${name}]\n${input}`
	}

	// Handle AI SDK tool-result format (alongside legacy tool_result below)
	if (isAnyToolResultBlock(block as { type: string })) {
		const trBlock = block as unknown as AnyToolResultBlock
		const isError = getToolResultIsError(trBlock)
		const errorSuffix = isError ? " (Error)" : ""
		const rawContent = getToolResultContent(trBlock)
		if (typeof rawContent === "string") {
			return `[Tool${errorSuffix}]\n${rawContent}`
		} else if (Array.isArray(rawContent)) {
			return `[Tool${errorSuffix}]\n${rawContent
				.map((contentBlock: ExtendedContentBlock) => formatContentBlockToMarkdown(contentBlock))
				.join("\n")}`
		} else if (rawContent && typeof rawContent === "object" && "value" in rawContent) {
			return `[Tool${errorSuffix}]\n${String((rawContent as { value: unknown }).value)}`
		}
		return `[Tool${errorSuffix}]`
	}

	switch (block.type) {
		case "text":
			return block.text
		case "image":
			return `[Image]`
		case "reasoning":
			return `[Reasoning]\n${(block as ReasoningBlock).text}`
		case "thoughtSignature":
			// Not relevant for human-readable exports
			return ""
		default:
			return `[Unexpected content type: ${block.type}]`
	}
}

export function findToolName(toolCallId: string, messages: Anthropic.MessageParam[]): string {
	for (const message of messages) {
		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool_use" && block.id === toolCallId) {
					return block.name
				}
			}
		}
	}
	return "Unknown Tool"
}
