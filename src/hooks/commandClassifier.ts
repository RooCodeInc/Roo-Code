/**
 * Phase 2 — Command Classification
 *
 * Requirement 1: Classify commands as SAFE (read-only) or DESTRUCTIVE
 * (write, delete, execute). SAFE tools bypass enforcement; DESTRUCTIVE
 * tools are subject to authorization + scope enforcement.
 *
 * This mirrors the SAFE_TOOLS set from Phase 1 (BaseTool.ts) but lives
 * in its own module so the hook engine can use it independently.
 */

import type { ToolClassification } from "./types"

// ---------------------------------------------------------------------------
// Safe tool set — tools that never mutate the workspace
// ---------------------------------------------------------------------------

/**
 * Tools classified as SAFE (read-only / non-destructive).
 * These bypass all hook enforcement in governed mode.
 *
 * Kept in sync with SAFE_TOOLS in BaseTool.ts.
 */
const SAFE_TOOL_SET: ReadonlySet<string> = new Set([
	// ── Read-only tools ──
	"read_file",
	"search_files",
	"list_files",
	"codebase_search",
	"read_command_output",

	// ── Non-destructive / meta tools ──
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"update_todo_list",
	"run_slash_command",
	"skill",

	// ── Intent tool itself ──
	"select_active_intent",
])

// ---------------------------------------------------------------------------
// Destructive tool set — tools that mutate files or execute commands
// ---------------------------------------------------------------------------

/**
 * Tools explicitly classified as DESTRUCTIVE.
 * Any tool NOT in SAFE_TOOL_SET is treated as destructive, but this
 * explicit list is kept for documentation and quick lookup.
 */
const DESTRUCTIVE_TOOL_SET: ReadonlySet<string> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
	"use_mcp_tool",
	"access_mcp_resource",
	"generate_image",
])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a tool as SAFE or DESTRUCTIVE.
 *
 * @param toolName - The tool name string from the LLM's tool_use block.
 * @returns `"safe"` if the tool is read-only, `"destructive"` otherwise.
 */
export function classifyTool(toolName: string): ToolClassification {
	if (SAFE_TOOL_SET.has(toolName)) {
		return "safe"
	}
	return "destructive"
}

/**
 * Check whether a tool is in the explicit destructive set.
 * Useful for logging / telemetry.
 */
export function isExplicitlyDestructive(toolName: string): boolean {
	return DESTRUCTIVE_TOOL_SET.has(toolName)
}
