import type { ClineMessage } from "@roo-code/types"
import { safeJsonParse } from "../../shared/safeJsonParse"

/**
 * Formats task messages as markdown, similar to how the UI displays them.
 * This follows the same formatting logic used in the webview UI components.
 * @param messages Array of ClineMessage objects from a task
 * @returns Formatted markdown string
 */
export function formatTaskAsMarkdown(messages: ClineMessage[]): string {
	if (!messages || messages.length === 0) {
		return ""
	}

	const markdownParts: string[] = []

	for (const message of messages) {
		const messageMarkdown = formatMessageAsMarkdown(message)
		if (messageMarkdown) {
			markdownParts.push(messageMarkdown)
		}
	}

	return markdownParts.join("\n\n---\n\n")
}

function formatMessageAsMarkdown(message: ClineMessage): string {
	const parts: string[] = []

	// Handle different message types
	if (message.type === "say") {
		switch (message.say) {
			case "user_feedback":
				parts.push("## Human")
				if (message.text) {
					parts.push(message.text)
				}
				if (message.images && message.images.length > 0) {
					parts.push(`*[${message.images.length} image(s) attached]*`)
				}
				break

			case "text":
				parts.push("## Assistant")
				if (message.text) {
					parts.push(message.text)
				}
				break

			case "error":
				parts.push("## Error")
				if (message.text) {
					parts.push(`\`\`\`\n${message.text}\n\`\`\``)
				}
				break

			case "completion_result":
				parts.push("## Task Completed")
				if (message.text) {
					parts.push(message.text)
				}
				break

			case "api_req_started":
				// Skip API request started messages in markdown export
				return ""

			case "api_req_finished":
				// Skip API request finished messages in markdown export
				return ""

			case "reasoning":
				parts.push("## Reasoning")
				if (message.text) {
					parts.push(`> ${message.text.split("\n").join("\n> ")}`)
				}
				break

			default:
				// For other message types, include them with a generic header
				if (message.text) {
					parts.push(`## ${message.say}`)
					parts.push(message.text)
				}
		}
	} else if (message.type === "ask") {
		switch (message.ask) {
			case "tool": {
				const tool = safeJsonParse<any>(message.text)
				if (tool) {
					parts.push(formatToolUseAsMarkdown(tool, "ask"))
				}
				break
			}

			case "command":
				parts.push("## Command Execution")
				if (message.text) {
					parts.push(`\`\`\`bash\n${message.text}\n\`\`\``)
				}
				break

			case "completion_result":
				parts.push("## Task Completion Request")
				if (message.text) {
					parts.push(message.text)
				}
				break

			case "followup":
				parts.push("## Question")
				if (message.text) {
					const followUpData = safeJsonParse<any>(message.text)
					if (followUpData?.question) {
						parts.push(followUpData.question)
					} else {
						parts.push(message.text)
					}
				}
				break

			default:
				// For other ask types, include them with a generic header
				if (message.text) {
					parts.push(`## ${message.ask}`)
					parts.push(message.text)
				}
		}
	}

	return parts.join("\n\n")
}

function formatToolUseAsMarkdown(tool: any, messageType: "ask" | "say"): string {
	const parts: string[] = []
	const isRequest = messageType === "ask"

	switch (tool.tool) {
		case "readFile":
			parts.push(`## ${isRequest ? "Reading" : "Read"} File`)
			if (tool.path) {
				parts.push(`**Path:** \`${tool.path}\``)
			}
			if (!isRequest && tool.content) {
				parts.push(`\`\`\`\n${tool.content}\n\`\`\``)
			}
			break

		case "newFileCreated":
			parts.push(`## ${isRequest ? "Creating" : "Created"} File`)
			if (tool.path) {
				parts.push(`**Path:** \`${tool.path}\``)
			}
			if (tool.content) {
				parts.push(`\`\`\`\n${tool.content}\n\`\`\``)
			}
			break

		case "editedExistingFile":
		case "appliedDiff":
			parts.push(`## ${isRequest ? "Editing" : "Edited"} File`)
			if (tool.path) {
				parts.push(`**Path:** \`${tool.path}\``)
			}
			if (tool.diff || tool.content) {
				parts.push(`\`\`\`diff\n${tool.diff || tool.content}\n\`\`\``)
			}
			break

		case "listFilesTopLevel":
		case "listFilesRecursive": {
			const recursive = tool.tool === "listFilesRecursive"
			parts.push(`## ${isRequest ? "Listing" : "Listed"} Files${recursive ? " (Recursive)" : ""}`)
			if (tool.path) {
				parts.push(`**Path:** \`${tool.path}\``)
			}
			if (tool.content) {
				parts.push(`\`\`\`\n${tool.content}\n\`\`\``)
			}
			break
		}

		case "searchFiles":
			parts.push(`## ${isRequest ? "Searching" : "Searched"} Files`)
			if (tool.regex) {
				parts.push(`**Pattern:** \`${tool.regex}\``)
			}
			if (tool.path) {
				parts.push(`**Path:** \`${tool.path}\``)
			}
			if (tool.content) {
				parts.push(`\`\`\`\n${tool.content}\n\`\`\``)
			}
			break

		case "updateTodoList":
			parts.push(`## Updated TODO List`)
			if (tool.todos && Array.isArray(tool.todos)) {
				parts.push(tool.todos.join("\n"))
			}
			break

		case "switchMode":
			parts.push(`## ${isRequest ? "Switching" : "Switched"} Mode`)
			if (tool.mode) {
				parts.push(`**Mode:** ${tool.mode}`)
			}
			if (tool.reason) {
				parts.push(`**Reason:** ${tool.reason}`)
			}
			break

		default:
			// For other tools, include a generic format
			parts.push(`## Tool: ${tool.tool}`)
			if (tool.content) {
				parts.push(`\`\`\`\n${tool.content}\n\`\`\``)
			}
	}

	return parts.join("\n\n")
}
