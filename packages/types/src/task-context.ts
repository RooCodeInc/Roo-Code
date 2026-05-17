import { z } from "zod"

/**
 * TaskPermissions defines fine-grained permission boundaries for a subtask.
 *
 * These permissions allow the orchestrator (or parent task) to restrict what
 * a child task can do, making parallel execution safer by preventing
 * unintended side effects across task boundaries.
 *
 * ## Design Notes
 *
 * Phase 3a introduces the types and plumbing. Enforcement is deferred to
 * Phase 3b (read-only parallelism) and Phase 3d (write parallelism).
 *
 * The permission model is intentionally additive: if no permissions are
 * specified, the task inherits full capabilities from its mode. Permissions
 * can only *restrict*, never *expand* beyond what the mode allows.
 */
export const taskPermissionsSchema = z.object({
	/**
	 * Glob patterns restricting which files the task may read.
	 * If empty or undefined, the task can read any file (subject to mode restrictions).
	 * Examples: ["docs/**", "src/utils/**"]
	 */
	fileReadPatterns: z.array(z.string()).optional(),

	/**
	 * Glob patterns restricting which files the task may write/edit.
	 * If empty or undefined, the task can write any file (subject to mode restrictions).
	 * Examples: ["docs/**", "package.json"]
	 */
	fileWritePatterns: z.array(z.string()).optional(),

	/**
	 * Allowlist of shell commands the task may execute.
	 * If empty or undefined, the task can execute any command (subject to mode restrictions).
	 * Matched as prefixes against the command string.
	 * Examples: ["npm test", "npx vitest", "git status"]
	 */
	allowedCommands: z.array(z.string()).optional(),

	/**
	 * Blocklist of shell commands the task may NOT execute.
	 * Takes precedence over allowedCommands.
	 * Examples: ["rm -rf", "git push"]
	 */
	blockedCommands: z.array(z.string()).optional(),

	/**
	 * Whether the task is restricted to read-only operations.
	 * When true, the task cannot use write tools (write_to_file, apply_diff,
	 * execute_command, etc.). This is the primary mechanism for Phase 3b
	 * read-only parallelism.
	 */
	readOnly: z.boolean().optional(),

	/**
	 * Explicit list of tool names the task is allowed to use.
	 * If empty or undefined, all tools available to the mode are allowed.
	 * Examples: ["read_file", "list_files", "search_files"]
	 */
	allowedTools: z.array(z.string()).optional(),
})

export type TaskPermissions = z.infer<typeof taskPermissionsSchema>

/**
 * TaskContext encapsulates all per-task configuration that a Task needs
 * to operate independently of the ClineProvider's shared mutable state.
 *
 * ## Purpose
 *
 * Today, Task reads mode, API config, and other settings from the provider
 * via `provider.getState()` at construction time and during execution.
 * This couples Task execution to the provider's current state, which
 * prevents multiple tasks from running concurrently (since they'd all
 * read/write the same shared state).
 *
 * TaskContext captures a snapshot of everything a Task needs at creation
 * time, so the Task can operate with its own isolated configuration.
 *
 * ## Lifecycle
 *
 * 1. Built by the parent (orchestrator or provider) when creating a subtask
 * 2. Passed to the Task constructor as an immutable snapshot
 * 3. The Task uses this context instead of reaching back to the provider
 *    for mode/config/permissions during execution
 *
 * ## Phase 3a Scope
 *
 * In Phase 3a, TaskContext is optional -- tasks that don't receive one
 * fall back to the existing provider.getState() behavior. This ensures
 * full backward compatibility while enabling incremental adoption.
 */
export const taskContextSchema = z.object({
	/**
	 * The mode slug for this task (e.g., "code", "architect", "ask").
	 * Snapshot at task creation time -- does not change if the provider's
	 * mode changes later.
	 */
	mode: z.string(),

	/**
	 * The API configuration profile name for this task.
	 * Allows subtasks to use different models (including local ones)
	 * from the parent task.
	 */
	apiConfigName: z.string().optional(),

	/**
	 * Permission boundaries for this task.
	 * If undefined, the task inherits full capabilities from its mode.
	 */
	permissions: taskPermissionsSchema.optional(),

	/**
	 * Whether this task should inherit skills from the parent.
	 * Defaults to true if not specified.
	 */
	inheritSkills: z.boolean().optional(),

	/**
	 * Additional skill overrides for this task.
	 * These are merged with (or replace) inherited skills depending
	 * on the inheritSkills setting.
	 */
	skillOverrides: z.array(z.string()).optional(),

	/**
	 * The workspace path for this task.
	 * Allows subtasks to operate in different workspace roots.
	 */
	workspacePath: z.string().optional(),

	/**
	 * ID of the parent task that created this context.
	 * Used for lineage tracking and result aggregation.
	 */
	parentTaskId: z.string().optional(),

	/**
	 * ID of the root task in the delegation chain.
	 * Used for hierarchical task management.
	 */
	rootTaskId: z.string().optional(),
})

export type TaskContext = z.infer<typeof taskContextSchema>

/**
 * Merge two TaskPermissions objects, producing the most restrictive
 * combination. This is used when a parent task's permissions should
 * further constrain a child task's permissions.
 *
 * Rules:
 * - readOnly: true if either is true
 * - allowedTools: intersection if both specified, otherwise the one that's specified
 * - fileReadPatterns / fileWritePatterns: intersection if both specified
 * - allowedCommands: intersection if both specified
 * - blockedCommands: union (all blocked commands from both)
 */
export function mergePermissions(
	parent: TaskPermissions | undefined,
	child: TaskPermissions | undefined,
): TaskPermissions | undefined {
	if (!parent && !child) {
		return undefined
	}

	if (!parent) {
		return child
	}

	if (!child) {
		return parent
	}

	return {
		readOnly: parent.readOnly || child.readOnly || undefined,

		fileReadPatterns: intersectArrays(parent.fileReadPatterns, child.fileReadPatterns),

		fileWritePatterns: intersectArrays(parent.fileWritePatterns, child.fileWritePatterns),

		allowedCommands: intersectArrays(parent.allowedCommands, child.allowedCommands),

		blockedCommands: unionArrays(parent.blockedCommands, child.blockedCommands),

		allowedTools: intersectArrays(parent.allowedTools, child.allowedTools),
	}
}

/** Return intersection of two optional arrays, or the defined one if only one exists. */
function intersectArrays(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
	if (!a && !b) {
		return undefined
	}

	if (!a) {
		return b
	}

	if (!b) {
		return a
	}

	const setB = new Set(b)
	const result = a.filter((item) => setB.has(item))
	return result.length > 0 ? result : []
}

/** Return union of two optional arrays. */
function unionArrays(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
	if (!a && !b) {
		return undefined
	}

	if (!a) {
		return b
	}

	if (!b) {
		return a
	}

	return Array.from(new Set([...a, ...b]))
}
