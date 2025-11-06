import { z } from "zod"

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
})

export type HistoryItem = z.infer<typeof historyItemSchema>

/**
 * Subtask Metadata Schema
 *
 * Validates subtask metadata stored with messages to ensure:
 * - Parent task IDs are valid UUIDs
 * - Depth values are non-negative integers
 * - All fields are optional for backward compatibility
 *
 * @example
 * ```typescript
 * const metadata = subtaskMetadataSchema.parse({
 *   parentTaskId: "550e8400-e29b-41d4-a716-446655440000",
 *   parentMessageId: "msg-123",
 *   depth: 1,
 *   requiresReturn: true
 * })
 * ```
 */
export const subtaskMetadataSchema = z
	.object({
		/**
		 * UUID of the parent task
		 * Must be a valid UUID format
		 */
		parentTaskId: z.string().uuid().optional(),

		/**
		 * Message ID to return to in the parent task
		 * Can be any string identifier
		 */
		parentMessageId: z.string().optional(),

		/**
		 * Nesting depth level (0 = root, 1+ = nested)
		 * Must be a non-negative integer
		 */
		depth: z.number().int().min(0).optional(),

		/**
		 * Whether this subtask must return to parent on completion
		 */
		requiresReturn: z.boolean().optional(),
	})
	.optional()

export type SubtaskMetadata = z.infer<typeof subtaskMetadataSchema>
