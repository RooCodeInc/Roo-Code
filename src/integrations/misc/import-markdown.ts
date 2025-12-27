import * as vscode from "vscode"
import { ClineMessage, ClineSay, ClineAsk } from "@roo-code/types"

/**
 * Parse a Markdown file exported by Roo-Code and convert to ClineMessages for display
 * Uses the same message format as the existing chat system for proper rendering
 */
export async function importTask(): Promise<{
	success: boolean
	clineMessages?: ClineMessage[]
	taskDescription?: string
	error?: string
}> {
	const fileUri = await vscode.window.showOpenDialog({
		canSelectMany: false,
		filters: { Markdown: ["md"] },
		title: "Select exported task markdown file",
	})

	if (!fileUri || fileUri.length === 0) {
		return { success: false, error: "No file selected" }
	}

	try {
		const fileContent = await vscode.workspace.fs.readFile(fileUri[0])
		const markdownContent = Buffer.from(fileContent).toString("utf-8")

		const clineMessages = parseMarkdownToClineMessages(markdownContent)

		if (clineMessages.length === 0) {
			return { success: false, error: "No conversation found in the markdown file" }
		}

		// Extract task description from first user_feedback message
		let taskDescription = "[Imported Task]"
		const firstUserMsg = clineMessages.find((m) => m.say === "user_feedback")
		if (firstUserMsg?.text) {
			taskDescription = firstUserMsg.text.slice(0, 200)
		}

		return { success: true, clineMessages, taskDescription }
	} catch (error) {
		return {
			success: false,
			error: `Failed to import task: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

/**
 * Parse markdown directly to ClineMessage format
 * This generates messages in the same format that ChatRow expects
 */
function parseMarkdownToClineMessages(markdownContent: string): ClineMessage[] {
	const messages: ClineMessage[] = []
	let ts = Date.now() - 100000

	// Split by message separator (---)
	const sections = markdownContent.split(/\n---\n/)

	for (const section of sections) {
		const trimmedSection = section.trim()
		if (!trimmedSection) continue

		const userMatch = trimmedSection.match(/^\*\*User:\*\*\s*([\s\S]*)/i)
		const assistantMatch = trimmedSection.match(/^\*\*Assistant:\*\*\s*([\s\S]*)/i)

		if (userMatch) {
			const content = userMatch[1].trim()
			messages.push(...parseUserContent(content, ts++))
		} else if (assistantMatch) {
			const content = assistantMatch[1].trim()
			messages.push(...parseAssistantContent(content, ts++))
		}
	}

	return messages
}

/**
 * Parse user message content - generates proper ClineMessage format
 * Note: In the export format, "User" messages contain:
 * - Actual user input (task, feedback)
 * - Tool results (which are NOT user messages, they're system responses)
 * - User interrupts with <feedback> and <user_message> tags
 * We should only show actual user input, not tool results
 */
function parseUserContent(content: string, baseTs: number): ClineMessage[] {
	const messages: ClineMessage[] = []
	let ts = baseTs

	// Check for tool results - these are NOT user messages, they're system responses
	// Formats:
	// - [Tool] or [Tool (Error)]
	// - [read_file for '...'] Result:
	// - [xxx for '...'] Result: (with complex content inside quotes)
	const hasToolResult =
		/\[Tool( \(Error\))?\]/.test(content) ||
		/\[\w+\s+for\s+['"]/.test(content) || // Match start of tool result
		/\]\s*Result:/.test(content) || // Match end of tool result
		/<files>/.test(content) || // Match file content
		/<content/.test(content) // Match content tags

	if (hasToolResult) {
		// Check if there's user feedback/message embedded in the tool result
		// This happens when user interrupts AI with feedback
		const feedbackMatch = content.match(/<feedback>([\s\S]*?)<\/feedback>/)
		const userMessageMatch = content.match(/<user_message>([\s\S]*?)<\/user_message>/)

		if (feedbackMatch) {
			messages.push({
				ts: ts++,
				type: "say",
				say: "user_feedback" as ClineSay,
				text: feedbackMatch[1].trim(),
			})
		}

		if (userMessageMatch) {
			messages.push({
				ts: ts++,
				type: "say",
				say: "user_feedback" as ClineSay,
				text: userMessageMatch[1].trim(),
			})
		}

		// Skip the rest of tool result content
		return messages
	}

	// Extract actual user text (task, feedback, etc.)
	const userText = extractUserText(content)
	if (userText) {
		messages.push({
			ts: ts++,
			type: "say",
			say: "user_feedback" as ClineSay,
			text: userText,
		})
	}

	return messages
}

/**
 * Extract clean user text from content
 */
function extractUserText(content: string): string {
	let text = content
	// Remove environment_details
	text = text.replace(/<environment_details>[\s\S]*?<\/environment_details>/g, "")
	// Extract task content if present
	const taskMatch = text.match(/<task>([\s\S]*?)<\/task>/)
	if (taskMatch) {
		text = taskMatch[1]
	}
	// Remove [Image] placeholders
	text = text.replace(/\[Image\]/g, "")
	return text.trim()
}

/**
 * Parse assistant message content - generates proper ClineMessage format
 */
function parseAssistantContent(content: string, baseTs: number): ClineMessage[] {
	const messages: ClineMessage[] = []
	let ts = baseTs
	let remaining = content

	// Extract [Reasoning] blocks first
	const reasoningRegex = /\[Reasoning\]\n([\s\S]*?)(?=\n\[Tool Use:|\n<[a-z_]+>|$)/g
	let match

	while ((match = reasoningRegex.exec(content)) !== null) {
		messages.push({
			ts: ts++,
			type: "say",
			say: "reasoning" as ClineSay,
			text: match[1].trim(),
		})
		remaining = remaining.replace(match[0], "")
	}

	// Extract [Tool Use: name] blocks
	const toolUseRegex = /\[Tool Use: ([^\]]+)\]\n([\s\S]*?)(?=\n\[Tool Use:|\n<[a-z_]+>|$)/g
	while ((match = toolUseRegex.exec(content)) !== null) {
		const toolName = match[1]
		const toolInput = match[2].trim()

		// Create a tool message in the format ChatRow expects
		messages.push({
			ts: ts++,
			type: "ask",
			ask: "tool" as ClineAsk,
			text: JSON.stringify(createToolObject(toolName, toolInput)),
		})
		remaining = remaining.replace(match[0], "")
	}

	// Extract XML tool calls like <read_file>...</read_file>
	const xmlToolRegex = /<([a-z][a-z0-9_]*?)>([\s\S]*?)<\/\1>/g
	while ((match = xmlToolRegex.exec(content)) !== null) {
		const toolName = match[1]
		const toolContent = match[2].trim()

		// Skip nested tags like <args>, <file>, <path> etc
		if (["args", "file", "path", "content", "diff", "line_range"].includes(toolName)) {
			continue
		}

		messages.push({
			ts: ts++,
			type: "ask",
			ask: "tool" as ClineAsk,
			text: JSON.stringify(createToolObject(toolName, toolContent)),
		})
		remaining = remaining.replace(match[0], "")
	}

	// Any remaining text is assistant's response
	remaining = remaining.trim()
	if (remaining) {
		messages.push({
			ts: ts++,
			type: "say",
			say: "text" as ClineSay,
			text: remaining,
		})
	}

	return messages
}

/**
 * Create a tool object in ClineSayTool format for ChatRow to render
 */
function createToolObject(toolName: string, content: string): Record<string, unknown> {
	// Map XML tool names to ClineSayTool tool names
	const toolMap: Record<string, string> = {
		read_file: "readFile",
		write_to_file: "newFileCreated",
		apply_diff: "appliedDiff",
		search_files: "searchFiles",
		list_files: "listFilesRecursive",
		execute_command: "command",
		browser_action: "browserAction",
		ask_followup_question: "followup",
		attempt_completion: "completion",
		insert_content: "insertContent",
		search_and_replace: "searchAndReplace",
	}

	const mappedTool = toolMap[toolName] || toolName

	// Extract path from content if present
	const pathMatch = content.match(/<path>([^<]+)<\/path>/)
	const path = pathMatch ? pathMatch[1] : undefined

	// Extract diff/content
	const diffMatch = content.match(/<diff>([\s\S]*?)<\/diff>/)
	const diff = diffMatch ? diffMatch[1] : undefined

	const contentMatch = content.match(/<content>([\s\S]*?)<\/content>/)
	const fileContent = contentMatch ? contentMatch[1] : content

	return {
		tool: mappedTool,
		path: path,
		diff: diff,
		content: fileContent,
	}
}
