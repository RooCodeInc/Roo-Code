import type { SubtaskSummary } from "@roo-code/types"
import type { ToolUsage } from "@roo-code/types"
import type { TodoItem } from "@roo-code/types"
import type Anthropic from "@anthropic-ai/sdk"

/**
 * File-modifying tool names. When these appear as tool_use blocks in the
 * API conversation history, the first positional argument (typically `path`)
 * is extracted as a modified file.
 */
const FILE_WRITE_TOOLS = new Set(["write_to_file", "apply_diff", "insert_content"])

/**
 * File-reading tool names.
 */
const FILE_READ_TOOLS = new Set(["read_file", "search_files", "list_files", "list_code_definition_names"])

/**
 * Extract a file path from a tool_use input object.
 * Native tool calls store params as structured objects with a `path` field.
 */
function extractPath(input: Record<string, unknown>): string | undefined {
	if (typeof input.path === "string" && input.path.length > 0) {
		return input.path
	}
	return undefined
}

/**
 * Extract a command string from a tool_use input for execute_command.
 */
function extractCommand(input: Record<string, unknown>): string | undefined {
	if (typeof input.command === "string" && input.command.length > 0) {
		const cmd = input.command
		return cmd.length > 120 ? cmd.slice(0, 117) + "..." : cmd
	}
	return undefined
}

/**
 * Minimal interface representing the data we need from a Task instance.
 * Using an interface avoids importing the full Task class (circular deps).
 */
export interface SubtaskContext {
	apiConversationHistory: Anthropic.MessageParam[]
	toolUsage: ToolUsage
	todoList?: TodoItem[]
	taskMode: string
}

/**
 * Builds a structured SubtaskSummary from task context.
 *
 * This scans the task's API conversation history to extract:
 * - Files modified (write_to_file, apply_diff, insert_content)
 * - Files read (read_file, search_files, etc.)
 * - Commands executed (execute_command)
 * - Tool usage summary (from toolUsage)
 * - Todo completion stats (from todoList)
 *
 * The result text comes from attempt_completion and is passed in separately.
 */
export function buildSubtaskSummary(context: SubtaskContext, completionResult: string): SubtaskSummary {
	const filesModified = new Set<string>()
	const filesRead = new Set<string>()
	const commandsExecuted: string[] = []

	// Scan API conversation history for tool_use blocks
	for (const message of context.apiConversationHistory) {
		if (message.role !== "assistant" || !Array.isArray(message.content)) {
			continue
		}

		for (const block of message.content as Anthropic.ContentBlockParam[]) {
			if (block.type !== "tool_use") {
				continue
			}

			const toolBlock = block as Anthropic.ToolUseBlockParam
			const toolName = toolBlock.name
			const input = (toolBlock.input ?? {}) as Record<string, unknown>

			if (FILE_WRITE_TOOLS.has(toolName)) {
				const path = extractPath(input)
				if (path) {
					filesModified.add(path)
				}
			} else if (FILE_READ_TOOLS.has(toolName)) {
				const path = extractPath(input)
				if (path) {
					filesRead.add(path)
				}
			} else if (toolName === "execute_command") {
				const cmd = extractCommand(input)
				if (cmd) {
					commandsExecuted.push(cmd)
				}
			}
		}
	}

	// Build tool usage summary from toolUsage
	const toolUsageSummary: Record<string, number> = {}
	if (context.toolUsage) {
		for (const [toolName, usage] of Object.entries(context.toolUsage)) {
			const u = usage as { attempts: number; failures: number } | undefined
			if (u && u.attempts > 0) {
				toolUsageSummary[toolName] = u.attempts
			}
		}
	}

	// Build todo stats
	let todoStats: SubtaskSummary["todoStats"]
	if (context.todoList && context.todoList.length > 0) {
		const completed = context.todoList.filter((t: TodoItem) => t.status === "completed").length
		todoStats = { completed, total: context.todoList.length }
	}

	const summary: SubtaskSummary = {
		result: completionResult,
		mode: context.taskMode,
	}

	if (filesModified.size > 0) {
		summary.filesModified = Array.from(filesModified)
	}

	if (filesRead.size > 0) {
		summary.filesRead = Array.from(filesRead)
	}

	if (commandsExecuted.length > 0) {
		summary.commandsExecuted = commandsExecuted
	}

	if (Object.keys(toolUsageSummary).length > 0) {
		summary.toolUsageSummary = toolUsageSummary
	}

	if (todoStats) {
		summary.todoStats = todoStats
	}

	return summary
}

/**
 * Formats a SubtaskSummary into a human-readable string suitable for
 * injection into the parent's API history (tool_result content).
 * This enriched format gives the parent LLM much better context about
 * what the subtask accomplished.
 */
export function formatSubtaskSummaryForApi(summary: SubtaskSummary): string {
	const sections: string[] = []

	// Result section (always present)
	sections.push(`## Result\n${summary.result}`)

	// Mode
	if (summary.mode) {
		sections.push(`## Mode\n${summary.mode}`)
	}

	// Files modified
	if (summary.filesModified && summary.filesModified.length > 0) {
		const fileList = summary.filesModified.map((f: string) => `- ${f}`).join("\n")
		sections.push(`## Files Modified\n${fileList}`)
	}

	// Files read
	if (summary.filesRead && summary.filesRead.length > 0) {
		const fileList = summary.filesRead.map((f: string) => `- ${f}`).join("\n")
		sections.push(`## Files Read\n${fileList}`)
	}

	// Commands executed
	if (summary.commandsExecuted && summary.commandsExecuted.length > 0) {
		const cmdList = summary.commandsExecuted.map((c: string) => `- \`${c}\``).join("\n")
		sections.push(`## Commands Executed\n${cmdList}`)
	}

	// Todo stats
	if (summary.todoStats) {
		sections.push(`## Todos\n${summary.todoStats.completed}/${summary.todoStats.total} completed`)
	}

	return sections.join("\n\n")
}
