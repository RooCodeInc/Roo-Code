/**
 * Hook System Types and Zod Schemas
 *
 * This module defines the configuration schema and types for the Roo Code hooks system.
 * Compatible with Claude Code hook semantics.
 */

import { z } from "zod"
import type { HookExecutionOutputStatusPayload } from "@roo-code/types"

// ============================================================================
// Hook Events
// ============================================================================

/**
 * All supported hook event types.
 * Blocking events can halt/modify execution via exit code 2.
 * Non-blocking events are informational only.
 */
export const HookEventType = z.enum([
	"PreToolUse", // Before tool execution (blocking)
	"PostToolUse", // After successful tool completion
	"PostToolUseFailure", // After tool execution fails
	"PermissionRequest", // When tool approval dialog shown (blocking)
	"UserPromptSubmit", // When user sends message (blocking)
	"Stop", // When task completes or stops (blocking)
	"SubagentStop", // When subtask completes (blocking)
	"SubagentStart", // When subtask begins
	"SessionStart", // When new task created
	"SessionEnd", // When task fully ends
	"Notification", // When status messages sent
	"PreCompact", // Before context compaction
])

export type HookEventType = z.infer<typeof HookEventType>

/**
 * Events that can block execution by returning exit code 2.
 */
export const BLOCKING_EVENTS: Set<HookEventType> = new Set([
	"PreToolUse",
	"PermissionRequest",
	"UserPromptSubmit",
	"Stop",
	"SubagentStop",
])

/**
 * Check if an event type supports blocking behavior.
 */
export function isBlockingEvent(event: HookEventType): boolean {
	return BLOCKING_EVENTS.has(event)
}

// ==========================================================================
// Event Categories and Matchers
// ==========================================================================

// Event categories based on matcher semantics
export const TOOL_EVENTS = ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest"] as const
export type ToolEvent = (typeof TOOL_EVENTS)[number]

export const LIFECYCLE_EVENTS_WITH_MATCHERS = ["SessionStart", "Notification", "PreCompact"] as const
export type LifecycleEventWithMatcher = (typeof LIFECYCLE_EVENTS_WITH_MATCHERS)[number]

export const LIFECYCLE_EVENTS_WITHOUT_MATCHERS = [
	"Stop",
	"SubagentStart",
	"SubagentStop",
	"SessionEnd",
	"UserPromptSubmit",
] as const
export type LifecycleEventWithoutMatcher = (typeof LIFECYCLE_EVENTS_WITHOUT_MATCHERS)[number]

// Tool matchers (for tool events)
export const TOOL_MATCHERS = ["read", "edit", "browser", "command", "mcp", "modes"] as const
export type ToolMatcher = (typeof TOOL_MATCHERS)[number]

// Session start matchers
export const SESSION_START_MATCHERS = ["startup", "resume", "clear", "compact"] as const
export type SessionStartMatcher = (typeof SESSION_START_MATCHERS)[number]

// Notification matchers
export const NOTIFICATION_MATCHERS = ["permission_prompt", "idle_prompt", "auth_success", "elicitation_dialog"] as const
export type NotificationMatcher = (typeof NOTIFICATION_MATCHERS)[number]

// PreCompact matchers
export const PRE_COMPACT_MATCHERS = ["manual", "auto"] as const
export type PreCompactMatcher = (typeof PRE_COMPACT_MATCHERS)[number]

// Union of all event-specific matchers
export type EventMatcher = ToolMatcher | SessionStartMatcher | NotificationMatcher | PreCompactMatcher

// Map from event type to valid matcher values
export const EVENT_MATCHER_MAP: Record<HookEventType, readonly string[] | null> = {
	// Tool events use tool matchers
	PreToolUse: TOOL_MATCHERS,
	PostToolUse: TOOL_MATCHERS,
	PostToolUseFailure: TOOL_MATCHERS,
	PermissionRequest: TOOL_MATCHERS,
	// Lifecycle events with specific matchers
	SessionStart: SESSION_START_MATCHERS,
	Notification: NOTIFICATION_MATCHERS,
	PreCompact: PRE_COMPACT_MATCHERS,
	// Lifecycle events without matchers
	Stop: null,
	SubagentStart: null,
	SubagentStop: null,
	SessionEnd: null,
	UserPromptSubmit: null,
}

/**
 * Check if an event type is a tool event (uses tool matchers)
 */
export function isToolEvent(event: HookEventType): event is ToolEvent {
	return (TOOL_EVENTS as readonly string[]).includes(event)
}

/**
 * Check if an event type supports matchers
 */
export function eventSupportsMatchers(event: HookEventType): boolean {
	return EVENT_MATCHER_MAP[event] !== null
}

/**
 * Get valid matcher values for a given event type
 * Returns null for events that don't support matchers
 */
export function getValidMatchersForEvent(event: HookEventType): readonly string[] | null {
	return EVENT_MATCHER_MAP[event]
}

/**
 * Validate if a matcher value is valid for a given event type
 * For tool events, also accepts custom patterns (regex/glob)
 */
export function isValidMatcherForEvent(event: HookEventType, matcher: string): boolean {
	const validMatchers = EVENT_MATCHER_MAP[event]

	// Events without matchers should not have any matcher
	if (validMatchers === null) {
		return false
	}

	// For tool events, allow custom patterns (any non-empty string is valid as it could be regex/glob)
	if (isToolEvent(event)) {
		return matcher.length > 0
	}

	// For other events with matchers, check against valid values (can be | separated)
	const matcherParts = matcher
		.split("|")
		.map((m) => m.trim())
		.filter((m) => m.length > 0)

	return matcherParts.every((part) => (validMatchers as readonly string[]).includes(part))
}

// ============================================================================
// Hook Definition Schema
// ============================================================================

/**
 * Schema for a single hook definition within a config file.
 */
export const HookDefinitionSchema = z
	.object({
		/** Unique identifier for this hook */
		id: z.string().min(1, "Hook ID cannot be empty"),

		/** Tool name filter (regex/glob pattern). If omitted, matches all tools. */
		matcher: z.string().optional(),

		/** Whether this hook is enabled. Defaults to true. */
		enabled: z.boolean().optional().default(true),

		/** Shell command to execute */
		command: z.string().min(1, "Command cannot be empty"),

		/** Timeout in seconds. Defaults to 60. */
		timeout: z.number().positive().optional().default(60),

		/** Human-readable description of what this hook does */
		description: z.string().optional(),

		/** Override shell (default: user's shell on Unix, PowerShell on Windows) */
		shell: z.string().optional(),

		/** Opt-in to receive conversation history in stdin. Defaults to false. */
		includeConversationHistory: z.boolean().optional().default(false),
	})
	.strip()

export type HookDefinition = z.infer<typeof HookDefinitionSchema>

/**
 * Schema for a single hook definition in the new (hook-centric) config format.
 */
export const HookDefinitionWithEventsSchema = HookDefinitionSchema.extend({
	/** Event types this hook should run for */
	events: z.array(HookEventType).min(1, "Hook must have at least one event"),
}).strip()

export type HookDefinitionWithEvents = z.infer<typeof HookDefinitionWithEventsSchema>

// ============================================================================
// Hook Config File Schema
// ============================================================================

/**
 * Schema for a hooks configuration file (.roo/hooks/*.yaml or *.json).
 */
export const LegacyHooksConfigFileSchema = z
	.object({
		/** Hooks organized by event type (legacy format) */
		hooks: z.record(HookEventType, z.array(HookDefinitionSchema)).optional().default({}),
	})
	.strip()

export type LegacyHooksConfigFile = z.infer<typeof LegacyHooksConfigFileSchema>

export const HooksConfigFileSchema = z.union([
	z
		.object({
			/** Hooks stored as an array with an events field (new format) */
			hooks: z.array(HookDefinitionWithEventsSchema).optional().default([]),
		})
		.strip(),
	LegacyHooksConfigFileSchema,
])
// Strip unknown keys (e.g., legacy version key)
// so the system does not read/write/require version keys.
// Note: .strip() is already applied to each branch above.

export type HooksConfigFile = z.infer<typeof HooksConfigFileSchema>

// ============================================================================
// Internal Types (for runtime use)
// ============================================================================

/**
 * Source of a hook configuration.
 */
export type HookSource = "project" | "mode" | "global"

/**
 * Data for updating a hook configuration.
 */
export interface HookUpdateData {
	/** Rename the hook ID (must be unique within the file) */
	id?: string
	events?: HookEventType[]
	matcher?: string
	command?: string
	timeout?: number
	enabled?: boolean
	description?: string
	shell?: string
	includeConversationHistory?: boolean
}

/**
 * Extended hook definition with source information.
 * Used internally after merging configs from multiple sources.
 */
export interface ResolvedHook extends HookDefinition {
	/** Which config source this hook came from */
	source: HookSource

	/**
	 * File creation timestamp (ms since epoch) for the config file this hook came from.
	 * Used for stable UI ordering.
	 */
	createdAt?: number

	/** The event type this hook is registered for */
	// NOTE: A hook ID can be registered for multiple events. The loader stores the full set
	// of events on `events`. `event` is retained for backwards-compatibility and will be set
	// to the first event encountered for the hook.
	event: HookEventType

	/** All event types this hook ID is registered for */
	events?: HookEventType[]

	/** File path where this hook was defined */
	filePath: string
}

/**
 * In-memory snapshot of all loaded hooks configuration.
 * This is immutable once created - changes require explicit reload.
 */
export interface HooksConfigSnapshot {
	/** All resolved hooks, organized by event type */
	hooksByEvent: Map<HookEventType, ResolvedHook[]>

	/** Lookup by hook ID for quick access */
	hooksById: Map<string, ResolvedHook>

	/** When this snapshot was created */
	loadedAt: Date

	/** IDs of hooks that have been disabled at runtime */
	disabledHookIds: Set<string>

	/** Whether project hooks are present (for security warnings) */
	hasProjectHooks: boolean
}

// ============================================================================
// Hook Context (passed to hooks via stdin)
// ============================================================================

/**
 * Session information included in hook context.
 */
export interface HookSessionContext {
	taskId: string
	sessionId: string
	mode: string

	/** Session start classification (SessionStart) */
	source?: "startup" | "resume" | "clear" | "compact"

	/** Session end classification (SessionEnd) */
	endReason?: string
}

/**
 * Project information included in hook context.
 */
export interface HookProjectContext {
	directory: string
	name: string
}

/**
 * Tool information for tool-related events.
 */
export interface HookToolContext {
	name: string
	input: Record<string, unknown>
	/** Only present for PostToolUse */
	output?: unknown
	/** Only present for PostToolUse */
	duration?: number
	/** Only present for PostToolUseFailure */
	error?: string
	/** Only present for PostToolUseFailure */
	errorMessage?: string
}

/**
 * User prompt information for UserPromptSubmit event.
 */
export interface HookPromptContext {
	text: string
	/**
	 * Image metadata for the prompt.
	 *
	 * Backwards compatible:
	 * - historically this was `string[]` (paths)
	 * - PRD expects count + (optional) sanitized paths
	 */
	images?: string[] | { count: number; paths?: string[] }
	/** If distinguishable: chat_input | edit_message | queued_message */
	source?: "chat_input" | "edit_message" | "queued_message"
}

/**
 * Notification information for Notification event.
 */
export interface HookNotificationContext {
	message: string
	type: string
	severity?: "info" | "warn" | "error"
	/** File/component identifier */
	source?: string
}

/** Stop information for Stop event. */
export interface HookStopContext {
	reason?: "user_cancelled" | "provider_cleanup" | "rehydrate" | "other"
	isAbandoned?: boolean
}

/** Subagent information for SubagentStart/SubagentStop events. */
export interface HookSubagentContext {
	parentTaskId?: string
	childTaskId?: string
	mode?: string
	/** Result payload (best-effort, depends on call site). */
	result?: unknown
}

/**
 * Conversation history entry (opt-in via includeConversationHistory).
 */
export interface ConversationHistoryEntry {
	role: "user" | "assistant"
	content: string
}

/**
 * Full context passed to hooks via stdin as JSON.
 */
export interface HookContext {
	event: HookEventType
	timestamp: string
	session: HookSessionContext
	project: HookProjectContext

	/**
	 * Matcher string for events that support matchers.
	 *
	 * Note: tool events still use `tool.name` for matching.
	 * Lifecycle events MAY set this in addition to any legacy matching mechanism.
	 */
	matcher?: string

	/** Tool context - present for tool-related events */
	tool?: HookToolContext

	/** Prompt context - present for UserPromptSubmit */
	prompt?: HookPromptContext

	/** Notification context - present for Notification event */
	notification?: HookNotificationContext

	/** Stop context - present for Stop event */
	stop?: HookStopContext

	/** Subagent context - present for SubagentStart/SubagentStop */
	subagent?: HookSubagentContext

	/** Stop reason - present for Stop event (legacy field) */
	reason?: string

	/** Summary - present for Stop event */
	summary?: string

	/** Conversation history - only if hook opts in via includeConversationHistory */
	conversationHistory?: ConversationHistoryEntry[]
}

// ============================================================================
// Hook Execution Types
// ============================================================================

/**
 * Exit code semantics for hooks.
 */
export enum HookExitCode {
	/** Success - continue execution */
	Success = 0,

	/** Block/deny - halt execution (only valid for blocking events) */
	Block = 2,
}

/**
 * Result of executing a single hook.
 */
export interface HookExecutionResult {
	/** The hook that was executed */
	hook: ResolvedHook

	/** Exit code from the process */
	exitCode: number | null

	/** stdout output (may contain JSON for modification) */
	stdout: string

	/** stderr output (shown to user on block) */
	stderr: string

	/** Execution duration in milliseconds */
	duration: number

	/** Whether the hook timed out */
	timedOut: boolean

	/** Error if hook failed to execute */
	error?: Error

	/** Parsed modification request from stdout (PreToolUse only) */
	modification?: HookModification
}

/**
 * Modification request from hook stdout (PreToolUse only).
 */
export interface HookModification {
	action: "modify"
	toolInput: Record<string, unknown>
}

/**
 * Schema for hook stdout modification response.
 */
export const HookModificationSchema = z.object({
	action: z.literal("modify"),
	toolInput: z.record(z.unknown()),
})

/**
 * Aggregated result of executing all hooks for an event.
 */
export interface HooksExecutionResult {
	/** Results from each hook */
	results: HookExecutionResult[]

	/** Whether any hook blocked execution (exit code 2) */
	blocked: boolean

	/** Block message from stderr if blocked */
	blockMessage?: string

	/** The hook that blocked, if any */
	blockingHook?: ResolvedHook

	/** Tool input modification, if any hook modified it */
	modification?: HookModification

	/** Total execution time for all hooks */
	totalDuration: number
}

// ============================================================================
// Hook Manager Interface
// ============================================================================

/**
 * Execution history entry for debugging/UI.
 */
export interface HookExecution {
	/** When the hook was executed */
	timestamp: Date

	/** The hook that was executed */
	hook: ResolvedHook

	/** The event that triggered execution */
	event: HookEventType

	/** Execution result */
	result: HookExecutionResult
}

/**
 * Options for hook execution.
 */
export interface ExecuteHooksOptions {
	/** Context to pass to hooks */
	context: HookContext

	/** Conversation history (will be included only for hooks with includeConversationHistory: true) */
	conversationHistory?: ConversationHistoryEntry[]

	/** Optional stable base execution id for this hook batch (if omitted, manager generates one). */
	executionId?: string

	/** Optional streaming output status callback (used by chat terminal UI). */
	outputStatusCallback?: (payload: HookExecutionOutputStatusPayload) => void

	/** Optional output throttling interval in ms (default handled by executor). */
	outputThrottleMs?: number

	/** Optional output compression / truncation settings (default handled by executor). */
	terminalOutputLineLimit?: number
	terminalOutputCharacterLimit?: number

	/**
	 * Optional lifecycle callback for persisted hook_execution chat rows.
	 * Called for each hook run with its unique executionId.
	 */
	hookExecutionCallback?: (event: {
		phase: "started" | "completed" | "failed" | "blocked"
		executionId: string
		hookId: string
		event: HookEventType
		toolName?: string
		command: string
		cwd: string
		/** Compressed/trimmed summary output for transcript persistence (terminal states only). */
		outputSummary?: string
		exitCode?: number | null
		durationMs?: number
		blockMessage?: string
		error?: string
		modified?: boolean
	}) => void | Promise<void>
}

/**
 * Hook manager service interface (per PRD FR5).
 */
export interface IHookManager {
	/** Load hooks configuration from all sources */
	loadHooksConfig(): Promise<HooksConfigSnapshot>

	/** Explicitly reload hooks configuration */
	reloadHooksConfig(): Promise<void>

	/** Execute all matching hooks for an event */
	executeHooks(event: HookEventType, options: ExecuteHooksOptions): Promise<HooksExecutionResult>

	/** Get all currently enabled hooks */
	getEnabledHooks(): ResolvedHook[]

	/** Enable or disable a specific hook by ID */
	setHookEnabled(hookId: string, enabled: boolean): Promise<void>

	/** Update a hook definition in its source file */
	updateHook(filePath: string, hookId: string, updates: HookUpdateData): Promise<void>

	/** Get execution history for debugging */
	getHookExecutionHistory(): HookExecution[]

	/** Get the current config snapshot (or null if not loaded) */
	getConfigSnapshot(): HooksConfigSnapshot | null
}
