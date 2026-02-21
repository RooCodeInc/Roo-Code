/**
 * Command classification for tool execution (safe vs destructive).
 * Used by hooks to decide approval and scope enforcement.
 */

/**
 * Command classification types
 */
export enum CommandType {
	SAFE = "SAFE",
	DESTRUCTIVE = "DESTRUCTIVE",
}

/**
 * Tools that only read or query; no file/system modifications.
 */
const SAFE_TOOLS = new Set([
	"read_file",
	"search_files",
	"list_files",
	"codebase_search",
	"read_command_output",
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"select_active_intent",
	"access_mcp_resource",
])

/**
 * Tools that modify files, run commands, or have side effects.
 * Includes aliases (e.g. write_file -> write_to_file) so classification works before alias resolution.
 */
const DESTRUCTIVE_TOOLS = new Set([
	"write_to_file",
	"write_file",
	"execute_command",
	"apply_diff",
	"apply_patch",
	"edit_file",
	"edit",
	"search_replace",
	"search_and_replace",
	"update_todo_list",
	"generate_image",
	"use_mcp_tool",
	"skill",
	"run_slash_command",
	"custom_tool",
])

/**
 * Classify a tool by name
 * @param toolName - Name of the tool to classify
 * @returns CommandType.SAFE or CommandType.DESTRUCTIVE
 */
export function classifyCommand(toolName: string): CommandType {
	const normalizedName = toolName.toLowerCase().trim()

	if (SAFE_TOOLS.has(normalizedName)) {
		return CommandType.SAFE
	}

	if (DESTRUCTIVE_TOOLS.has(normalizedName)) {
		return CommandType.DESTRUCTIVE
	}

	// Default to DESTRUCTIVE for unknown tools (fail-safe)
	console.warn(`Unknown tool classification: ${toolName}, defaulting to DESTRUCTIVE`)
	return CommandType.DESTRUCTIVE
}

/**
 * Check if a tool is destructive
 * @param toolName - Name of the tool
 * @returns true if destructive, false if safe
 */
export function isDestructiveCommand(toolName: string): boolean {
	return classifyCommand(toolName) === CommandType.DESTRUCTIVE
}

/**
 * Determine if a tool execution requires user approval
 * @param toolName - Name of the tool
 * @param blocked - Whether the operation was blocked by pre-hook
 * @param scopeViolation - Whether this is a scope violation
 * @returns true if approval dialog should be shown
 */
export function requiresApproval(toolName: string, blocked: boolean, scopeViolation: boolean): boolean {
	// Always require approval for blocked operations
	if (blocked) {
		return true
	}

	// Always require approval for scope violations (even if not blocked)
	if (scopeViolation) {
		return true
	}

	// Require approval for destructive commands
	if (isDestructiveCommand(toolName)) {
		return true
	}

	// Safe commands don't need approval
	return false
}
