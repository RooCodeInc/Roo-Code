import { z } from "zod"

/**
 * Schema for custom model information
 * Defines the properties that can be specified for custom models
 */
export const customModelInfoSchema = z.object({
	maxTokens: z.number().positive().optional(),
	contextWindow: z.number().positive(),
	supportsImages: z.boolean().optional(),
	supportsPromptCache: z.boolean(), // Required in ModelInfo
	supportsTemperature: z.boolean().optional(),
	inputPrice: z.number().nonnegative().optional(),
	outputPrice: z.number().nonnegative().optional(),
	cacheWritesPrice: z.number().nonnegative().optional(),
	cacheReadsPrice: z.number().nonnegative().optional(),
	description: z.string().optional(),
	supportsReasoningEffort: z.boolean().optional(),
	supportsReasoningBudget: z.boolean().optional(),
	requiredReasoningBudget: z.boolean().optional(),
	reasoningEffort: z.string().optional(),
})

/**
 * Schema for a custom models file
 * The file is a simple record of model IDs to model information
 * The provider is determined by the filename (e.g., openrouter.json)
 */
export const customModelsFileSchema = z.record(z.string(), customModelInfoSchema)

/**
 * Type for the content of a custom models file
 */
export type CustomModelsFile = z.infer<typeof customModelsFileSchema>

/**
 * Type for custom model information
 */
export type CustomModelInfo = z.infer<typeof customModelInfoSchema>
