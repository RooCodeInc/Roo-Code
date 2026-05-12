import { z } from "zod"

/**
 * ContextHandoffSummary
 *
 * Structured summary of what a subtask accomplished during execution.
 * Automatically collected when a subtask completes via attempt_completion
 * and passed back to the parent task alongside the freeform result string.
 *
 * This gives the parent (typically the Orchestrator) structured visibility
 * into the child's work without requiring the child to manually enumerate
 * every file it touched or command it ran.
 */
export const contextHandoffSummarySchema = z.object({
	/** Mode the subtask ran in (e.g., "code", "debug", "architect") */
	mode: z.string().optional(),
	/** Files that were created or modified by the subtask */
	filesModified: z.array(z.string()).default([]),
	/** Files that were read (but not modified) by the subtask */
	filesRead: z.array(z.string()).default([]),
	/** Shell commands that were executed by the subtask */
	commandsExecuted: z.array(z.string()).default([]),
	/** Count of each tool type used (e.g., { write_to_file: 3, read_file: 5 }) */
	toolUsageCounts: z.record(z.string(), z.number()).default({}),
	/** Total number of API requests made during the subtask */
	apiRequestCount: z.number().default(0),
	/** The freeform completion result from attempt_completion */
	result: z.string(),
})

export type ContextHandoffSummary = z.infer<typeof contextHandoffSummarySchema>
