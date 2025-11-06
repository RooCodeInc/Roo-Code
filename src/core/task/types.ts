/**
 * Type definitions for Task-related metadata
 */

/**
 * GPT-5 specific metadata stored with assistant messages
 * for maintaining conversation continuity across requests
 */
export interface Gpt5Metadata {
	/**
	 * The response ID from the previous GPT-5 API response
	 * Used to maintain conversation continuity in subsequent requests
	 */
	previous_response_id?: string
}

/**
 * Subtask metadata stored with messages to track parent-child relationships
 * across VSCode restarts. Enables persistent task hierarchy navigation.
 *
 * @example
 * ```typescript
 * // Creating a subtask message
 * const message: ClineMessageWithMetadata = {
 *   metadata: {
 *     subtask: {
 *       parentTaskId: "parent-uuid",
 *       parentMessageId: "msg-123",
 *       depth: 1,
 *       requiresReturn: true
 *     }
 *   }
 * }
 * ```
 */
export interface SubtaskMetadata {
	/**
	 * UUID of the parent task that spawned this subtask.
	 * Used to navigate back to the correct parent task context.
	 */
	parentTaskId?: string

	/**
	 * Message ID in the parent task to return to upon completion.
	 * Enables precise restoration of conversation state.
	 */
	parentMessageId?: string

	/**
	 * Nesting level of this subtask in the task hierarchy.
	 * - 0 = root task (no parent)
	 * - 1 = direct child of root
	 * - 2+ = nested subtasks
	 */
	depth?: number

	/**
	 * Indicates whether this subtask must return to its parent on completion.
	 * When true, the system will automatically navigate back to the parent task.
	 */
	requiresReturn?: boolean
}

/**
 * Extended ClineMessage type with GPT-5 and subtask metadata
 */
export interface ClineMessageWithMetadata {
	metadata?: {
		gpt5?: Gpt5Metadata
		subtask?: SubtaskMetadata
		[key: string]: any
	}
}
