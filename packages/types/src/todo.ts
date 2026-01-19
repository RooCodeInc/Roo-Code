import { z } from "zod"

/**
 * TodoStatus
 */
export const todoStatusSchema = z.enum(["pending", "in_progress", "completed"] as const)

export type TodoStatus = z.infer<typeof todoStatusSchema>

/**
 * TodoItem
 */
export const todoItemSchema = z.object({
	id: z.string(),
	content: z.string(),
	status: todoStatusSchema,
	// Optional fields for subtask tracking
	subtaskId: z.string().optional(), // ID of the linked subtask (child task) for direct cost/token attribution
	tokens: z.number().optional(), // Total tokens (in + out) for linked subtask
	cost: z.number().optional(), // Total cost for linked subtask
	added: z.number().optional(),
	removed: z.number().optional(),
})

export type TodoItem = z.infer<typeof todoItemSchema>
