import { z } from "zod"

import { contextHandoffSummarySchema } from "./context-handoff.js"
import { taskPermissionsSchema } from "./task-permissions.js"

/**
 * SubtaskQueueItem — a single queued subtask definition for sequential fan-out.
 * Used by the orchestrator to define a pipeline of subtasks that execute one after another.
 */
export const subtaskQueueItemSchema = z.object({
	mode: z.string(),
	message: z.string(),
})

export type SubtaskQueueItem = z.infer<typeof subtaskQueueItemSchema>

/**
 * SubtaskResult — the result of a completed subtask in a queue.
 */
export const subtaskResultSchema = z.object({
	taskId: z.string(),
	mode: z.string(),
	summary: z.string(),
})

export type SubtaskResult = z.infer<typeof subtaskResultSchema>

/**
 * HistoryItem
 */

export const historyItemSchema = z.object({
	id: z.string(),
	rootTaskId: z.string().optional(),
	parentTaskId: z.string().optional(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
	workspace: z.string().optional(),
	mode: z.string().optional(),
	apiConfigName: z.string().optional(), // Provider profile name for sticky profile feature
	background: z.boolean().optional(), // true if this was a background task
	status: z.enum(["active", "completed", "delegated", "interrupted"]).optional(),
	delegatedToId: z.string().optional(), // Last child this parent delegated to
	childIds: z.array(z.string()).optional(), // All children spawned by this task
	awaitingChildId: z.string().optional(), // Child currently awaited (set when delegated)
	completedByChildId: z.string().optional(), // Child that completed and resumed this parent
	completionResultSummary: z.string().optional(), // Summary from completed child
	// Sequential fan-out queue (Phase 2)
	subtaskQueue: z.array(subtaskQueueItemSchema).optional(), // Remaining subtasks to execute
	subtaskQueueIndex: z.number().optional(), // Current position in the original queue (0-based)
	subtaskResults: z.array(subtaskResultSchema).optional(), // Results from completed queue subtasks
	contextHandoffSummary: contextHandoffSummarySchema.optional(), // Structured context from completed child
	taskPermissions: taskPermissionsSchema.optional(), // Permission boundaries set by parent task
})

export type HistoryItem = z.infer<typeof historyItemSchema>

/**
 * SubtaskSummary
 *
 * Structured metadata produced when a subtask completes via attempt_completion
 * and hands off context back to its parent task. This enriches the handoff
 * with visibility into what the subtask actually did.
 */
export const subtaskSummarySchema = z.object({
	/** The completion result text from attempt_completion */
	result: z.string(),
	/** Mode slug the subtask ran in (e.g. "code", "architect") */
	mode: z.string().optional(),
	/** Files that were created or modified (write_to_file, apply_diff, insert_content) */
	filesModified: z.array(z.string()).optional(),
	/** Files that were read during the subtask */
	filesRead: z.array(z.string()).optional(),
	/** Shell commands that were executed */
	commandsExecuted: z.array(z.string()).optional(),
	/** Summary of tool usage counts: tool name -> number of attempts */
	toolUsageSummary: z.record(z.string(), z.number()).optional(),
	/** Todo list status at completion: [completed, total] */
	todoStats: z
		.object({
			completed: z.number(),
			total: z.number(),
		})
		.optional(),
})

export type SubtaskSummary = z.infer<typeof subtaskSummarySchema>
