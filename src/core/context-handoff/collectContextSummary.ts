import type { ClineMessage, ContextHandoffSummary } from "@roo-code/types"
import type { ClineSayTool } from "@roo-code/types"

/**
 * Tool types that indicate file modifications.
 */
const FILE_MODIFY_TOOLS: ClineSayTool["tool"][] = ["editedExistingFile", "appliedDiff", "newFileCreated"]

/**
 * Tool types that indicate file reads.
 */
const FILE_READ_TOOLS: ClineSayTool["tool"][] = ["readFile"]

/**
 * Maps ClineSayTool tool names to canonical tool names used in toolUsageCounts.
 */
const TOOL_NAME_MAP: Record<ClineSayTool["tool"], string> = {
	editedExistingFile: "write_to_file",
	appliedDiff: "apply_diff",
	newFileCreated: "write_to_file",
	codebaseSearch: "codebase_search",
	readFile: "read_file",
	readCommandOutput: "read_command_output",
	listFilesTopLevel: "list_files",
	listFilesRecursive: "list_files",
	searchFiles: "search_files",
	switchMode: "switch_mode",
	newTask: "new_task",
	finishTask: "attempt_completion",
	generateImage: "generate_image",
	imageGenerated: "generate_image",
	runSlashCommand: "slash_command",
	updateTodoList: "update_todo_list",
	skill: "skill",
}

/**
 * Safely parses a JSON string from a ClineMessage's text field.
 * Returns undefined if parsing fails.
 */
function safeParseToolJson(text: string | undefined): ClineSayTool | undefined {
	if (!text) return undefined
	try {
		return JSON.parse(text) as ClineSayTool
	} catch {
		return undefined
	}
}

/**
 * Collects a structured context summary from a task's clineMessages.
 *
 * Scans the message history to extract:
 * - Files that were modified (write_to_file, apply_diff, new file creation)
 * - Files that were read
 * - Shell commands that were executed
 * - Tool usage counts
 * - API request count
 *
 * @param messages - The task's clineMessages array
 * @param mode - The mode the task ran in
 * @param result - The freeform completion result from attempt_completion
 * @returns A ContextHandoffSummary with deduplicated, sorted data
 */
export function collectContextSummary(
	messages: ClineMessage[],
	mode: string | undefined,
	result: string,
): ContextHandoffSummary {
	const filesModified = new Set<string>()
	const filesRead = new Set<string>()
	const commandsExecuted: string[] = []
	const toolUsageCounts: Record<string, number> = {}
	let apiRequestCount = 0

	for (const msg of messages) {
		// Count API requests
		if (msg.say === "api_req_started") {
			apiRequestCount++
			continue
		}

		// Extract tool usage from "tool" ask/say messages
		if (msg.ask === "tool" || msg.say === "tool") {
			const toolData = safeParseToolJson(msg.text)
			if (!toolData) continue

			// Map to canonical tool name and count
			const canonicalName = TOOL_NAME_MAP[toolData.tool]
			if (canonicalName) {
				toolUsageCounts[canonicalName] = (toolUsageCounts[canonicalName] || 0) + 1
			}

			// Track file modifications
			if (FILE_MODIFY_TOOLS.includes(toolData.tool) && toolData.path) {
				filesModified.add(toolData.path)
			}

			// Track file reads (only if not also modified)
			if (FILE_READ_TOOLS.includes(toolData.tool) && toolData.path) {
				filesRead.add(toolData.path)
			}

			// Track commands from "command" ask messages
			continue
		}

		// Extract executed commands
		if (msg.ask === "command" && msg.text) {
			commandsExecuted.push(msg.text)
			toolUsageCounts["execute_command"] = (toolUsageCounts["execute_command"] || 0) + 1
		}
	}

	// Remove files from filesRead if they were also modified
	for (const file of filesModified) {
		filesRead.delete(file)
	}

	return {
		mode,
		filesModified: Array.from(filesModified).sort(),
		filesRead: Array.from(filesRead).sort(),
		commandsExecuted,
		toolUsageCounts,
		apiRequestCount,
		result,
	}
}

/**
 * Formats a ContextHandoffSummary into a human-readable string
 * suitable for injection into the parent's API conversation history.
 *
 * @param summary - The structured context summary
 * @returns A formatted string with sections for each data category
 */
export function formatContextSummaryForParent(summary: ContextHandoffSummary): string {
	const sections: string[] = []

	sections.push(`Result:\n${summary.result}`)

	if (summary.mode) {
		sections.push(`Mode: ${summary.mode}`)
	}

	if (summary.filesModified.length > 0) {
		sections.push(`Files Modified:\n${summary.filesModified.map((f) => `  - ${f}`).join("\n")}`)
	}

	if (summary.filesRead.length > 0) {
		sections.push(`Files Read:\n${summary.filesRead.map((f) => `  - ${f}`).join("\n")}`)
	}

	if (summary.commandsExecuted.length > 0) {
		sections.push(`Commands Executed:\n${summary.commandsExecuted.map((c) => `  - ${c}`).join("\n")}`)
	}

	if (Object.keys(summary.toolUsageCounts).length > 0) {
		const toolLines = Object.entries(summary.toolUsageCounts)
			.sort(([, a], [, b]) => b - a)
			.map(([tool, count]) => `  - ${tool}: ${count}`)
		sections.push(`Tool Usage:\n${toolLines.join("\n")}`)
	}

	sections.push(`API Requests: ${summary.apiRequestCount}`)

	return sections.join("\n\n")
}
