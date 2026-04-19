import type { ToolName } from "@roo-code/types"

export const SAFE_COMMANDS: ReadonlySet<ToolName> = new Set([
	"read_file",
	"list_files",
	"search_files",
	"codebase_search",
	"read_command_output",
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"select_active_intent",
	"update_todo_list",
	"run_slash_command",
	"skill",
	"access_mcp_resource",
])

export const DESTRUCTIVE_COMMANDS: ReadonlySet<ToolName> = new Set([
	"write_to_file",
	"apply_patch",
	"edit_file",
	"search_replace",
	"apply_diff",
	"edit",
	"search_and_replace",
	"execute_command",
	"use_mcp_tool",
	"new_task",
	"generate_image",
])

export type CommandRisk = "safe" | "destructive"

export function classifyCommand(toolName: ToolName): CommandRisk {
	if (DESTRUCTIVE_COMMANDS.has(toolName)) {
		return "destructive"
	}

	if (SAFE_COMMANDS.has(toolName)) {
		return "safe"
	}

	return "destructive"
}

export function isDestructiveCommand(toolName: ToolName): boolean {
	return classifyCommand(toolName) === "destructive"
}
