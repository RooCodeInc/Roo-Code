import { z } from "zod"

/**
 * SavedPrompt
 *
 * Represents a user-saved prompt that can be quickly inserted into the chat input.
 * Users can optionally associate a prompt with a specific API configuration,
 * which will be automatically selected when the prompt is used.
 */
export const savedPromptSchema = z.object({
	/**
	 * Unique identifier for the saved prompt
	 */
	id: z.string(),

	/**
	 * Display name for the prompt (used in UI and slash commands)
	 */
	name: z.string(),

	/**
	 * The actual prompt content to be inserted
	 */
	content: z.string(),

	/**
	 * Optional description for the prompt
	 */
	description: z.string().optional(),

	/**
	 * Optional API configuration ID to auto-select when using this prompt
	 */
	apiConfigId: z.string().optional(),

	/**
	 * Timestamp when the prompt was created
	 */
	createdAt: z.number(),

	/**
	 * Timestamp when the prompt was last updated
	 */
	updatedAt: z.number(),
})

export type SavedPrompt = z.infer<typeof savedPromptSchema>

/**
 * SavedPromptCreate
 *
 * Payload for creating a new saved prompt (without id and timestamps)
 */
export const savedPromptCreateSchema = savedPromptSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
})

export type SavedPromptCreate = z.infer<typeof savedPromptCreateSchema>

/**
 * SavedPromptUpdate
 *
 * Payload for updating an existing saved prompt
 */
export const savedPromptUpdateSchema = savedPromptSchema.partial().required({ id: true })

export type SavedPromptUpdate = z.infer<typeof savedPromptUpdateSchema>

/**
 * SavedPromptsExport
 *
 * Format for exporting/importing saved prompts
 */
export const savedPromptsExportSchema = z.object({
	version: z.literal(1),
	exportedAt: z.number(),
	prompts: z.array(savedPromptSchema),
})

export type SavedPromptsExport = z.infer<typeof savedPromptsExportSchema>
