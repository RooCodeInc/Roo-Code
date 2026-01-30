import { z } from "zod"

/**
 * Hook Event Types
 *
 * All supported hook event types that can trigger hook execution.
 * Based on Claude Code's hook system.
 */
export const hookEventTypes = [
	"SessionStart",
	"UserPromptSubmit",
	"PreToolUse",
	"PermissionRequest",
	"PostToolUse",
	"PostToolUseFailure",
	"SubtaskStart",
	"SubtaskStop",
	"Stop",
	"PreCompact",
	"SessionEnd",
] as const

export const hookEventTypeSchema = z.enum(hookEventTypes)
export type HookEventType = z.infer<typeof hookEventTypeSchema>

/**
 * Tool Matchers
 *
 * Categories of tools that can be matched for tool-related hooks.
 * Used with PreToolUse, PostToolUse, PostToolUseFailure, and PermissionRequest events.
 */
export const toolMatchers = ["read", "edit", "browser", "command", "mcp", "modes"] as const
export const toolMatcherSchema = z.enum(toolMatchers)
export type ToolMatcher = z.infer<typeof toolMatcherSchema>

/**
 * Session Matchers
 *
 * Session state types that can be matched for SessionStart hooks.
 */
export const sessionMatchers = ["startup", "resume", "clear", "compact"] as const
export const sessionMatcherSchema = z.enum(sessionMatchers)
export type SessionMatcher = z.infer<typeof sessionMatcherSchema>

/**
 * Action Types
 *
 * Types of actions that hooks can execute.
 */
export const hookActionTypes = ["command", "slashCommand"] as const
export const hookActionTypeSchema = z.enum(hookActionTypes)
export type HookActionType = z.infer<typeof hookActionTypeSchema>

/**
 * Shell Command Action
 *
 * Executes a shell command with optional working directory and timeout.
 */
export const shellCommandActionSchema = z.object({
	type: z.literal("command"),
	command: z.string().min(1),
	cwd: z.string().optional(),
	timeout: z.number().min(1).max(300).default(30),
})

export type ShellCommandAction = z.infer<typeof shellCommandActionSchema>

/**
 * Slash Command Action
 *
 * Executes an existing slash command defined in the project or globally.
 */
export const slashCommandActionSchema = z.object({
	type: z.literal("slashCommand"),
	command: z.string().min(1).startsWith("/"),
	args: z.string().optional(),
})

export type SlashCommandAction = z.infer<typeof slashCommandActionSchema>

/**
 * Hook Action
 *
 * Union of all action types that hooks can execute.
 */
export const hookActionSchema = z.discriminatedUnion("type", [shellCommandActionSchema, slashCommandActionSchema])

export type HookAction = z.infer<typeof hookActionSchema>

/**
 * Tool Matchers Config
 *
 * Configuration for matching tool-related hooks.
 * Includes both category matchers and custom regex patterns.
 */
export const toolMatchersConfigSchema = z.object({
	tools: z.array(toolMatcherSchema).optional(),
	customPattern: z.string().nullable().optional(),
})

export type ToolMatchersConfig = z.infer<typeof toolMatchersConfigSchema>

/**
 * Session Matchers Config
 *
 * Configuration for matching SessionStart hooks.
 */
export const sessionMatchersConfigSchema = z.object({
	sessionType: z.array(sessionMatcherSchema).optional(),
})

export type SessionMatchersConfig = z.infer<typeof sessionMatchersConfigSchema>

/**
 * Hook Configuration
 *
 * Individual hook configuration including ID, name, enabled state, action, and matchers.
 */
export const hookConfigSchema = z.object({
	id: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	name: z.string().min(1),
	enabled: z.boolean().default(true),
	action: hookActionSchema,
	matchers: z.union([toolMatchersConfigSchema, sessionMatchersConfigSchema]).optional(),
})

export type HookConfig = z.infer<typeof hookConfigSchema>

/**
 * Hooks File Structure
 *
 * Full structure of a .hooks configuration file.
 */
export const hooksFileSchema = z.object({
	$schema: z.string().optional(),
	version: z.literal("1.0"),
	hooks: z.record(hookEventTypeSchema, z.array(hookConfigSchema)).default({}),
})

export type HooksFile = z.infer<typeof hooksFileSchema>

/**
 * Hook with Metadata
 *
 * Extended hook configuration with additional metadata for UI display.
 */
export interface HookWithMetadata extends HookConfig {
	eventType: HookEventType
	source: "global" | "project"
	filePath?: string
}

/**
 * Hook Event Descriptions
 *
 * Human-readable descriptions for each hook event type.
 */
export const hookEventDescriptions: Record<HookEventType, string> = {
	SessionStart: "Session begins or resumes",
	UserPromptSubmit: "User submits a prompt",
	PreToolUse: "Before tool execution",
	PermissionRequest: "When permission dialog appears",
	PostToolUse: "After tool succeeds",
	PostToolUseFailure: "After tool fails",
	SubtaskStart: "When spawning a subtask",
	SubtaskStop: "When subtask finishes",
	Stop: "Claude finishes responding",
	PreCompact: "Before context compaction",
	SessionEnd: "Session terminates",
}

/**
 * Tool Matcher Descriptions
 *
 * Human-readable descriptions for each tool matcher category.
 */
export const toolMatcherDescriptions: Record<ToolMatcher, string> = {
	read: "file reading",
	edit: "file writing",
	browser: "web tools",
	command: "shell/bash",
	mcp: "protocol tools",
	modes: "mode tools",
}

/**
 * Session Matcher Descriptions
 *
 * Human-readable descriptions for each session matcher type.
 */
export const sessionMatcherDescriptions: Record<SessionMatcher, string> = {
	startup: "new session",
	resume: "existing session",
	clear: "conversation cleared",
	compact: "context compacted",
}

/**
 * Helper to determine if a hook event type uses tool matchers.
 *
 * @param eventType - The hook event type to check
 * @returns true if the event type supports tool matchers
 */
export function usesToolMatchers(eventType: HookEventType): boolean {
	return ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest"].includes(eventType)
}

/**
 * Helper to determine if a hook event type uses session matchers.
 *
 * @param eventType - The hook event type to check
 * @returns true if the event type supports session matchers
 */
export function usesSessionMatchers(eventType: HookEventType): boolean {
	return eventType === "SessionStart"
}

/**
 * Helper to determine if a hook event type uses no matchers.
 *
 * These hooks fire unconditionally when their event occurs.
 *
 * @param eventType - The hook event type to check
 * @returns true if the event type has no matchers
 */
export function usesNoMatchers(eventType: HookEventType): boolean {
	return !usesToolMatchers(eventType) && !usesSessionMatchers(eventType)
}

/**
 * Tool ID to Matcher Mapping
 *
 * Maps internal tool IDs to their corresponding matcher categories.
 * Used to determine which hooks should fire for a given tool.
 */
export const TOOL_TO_MATCHER: Record<string, ToolMatcher> = {
	// Read
	read_file: "read",
	list_files: "read",
	search_files: "read",
	codebase_search: "read",
	fetch_instructions: "read",

	// Edit
	write_to_file: "edit",
	apply_diff: "edit",
	apply_patch: "edit",
	edit_file: "edit",
	search_and_replace: "edit",
	search_replace: "edit",

	// Browser
	browser_action: "browser",

	// Command
	execute_command: "command",

	// MCP
	use_mcp_tool: "mcp",
	access_mcp_resource: "mcp",

	// Modes
	switch_mode: "modes",
	new_task: "modes",
}
