import axios from "axios"
import { z } from "zod"
import { type ModelInfo, IO_INTELLIGENCE_CACHE_DURATION } from "@roo-code/types"
import type { ModelRecord } from "../../../shared/api"
import { parseApiPrice } from "../../../shared/cost"

const ioIntelligenceModelSchema = z.object({
	id: z.string(),
	object: z.literal("model"),
	created: z.number(),
	owned_by: z.string(),
	root: z.string().nullable().optional(),
	parent: z.string().nullable().optional(),
	max_model_len: z.number().nullable().optional(),
	permission: z.array(
		z.object({
			id: z.string(),
			object: z.literal("model_permission"),
			created: z.number(),
			allow_create_engine: z.boolean(),
			allow_sampling: z.boolean(),
			allow_logprobs: z.boolean(),
			allow_search_indices: z.boolean(),
			allow_view: z.boolean(),
			allow_fine_tuning: z.boolean(),
			organization: z.string(),
			group: z.string().nullable(),
			is_blocking: z.boolean(),
		}),
	),
	max_tokens: z.number().nullable().optional(),
	context_window: z.number().optional(),
	supports_images_input: z.boolean().optional().default(false),
	supports_prompt_cache: z.boolean().optional().default(false),
	input_token_price: z.number().nullable().optional(),
	output_token_price: z.number().nullable().optional(),
	cache_write_token_price: z.number().nullable().optional(),
	cache_read_token_price: z.number().nullable().optional(),
	precision: z.string().nullable().optional(),
})

export type IOIntelligenceModel = z.infer<typeof ioIntelligenceModelSchema>

const ioIntelligenceApiResponseSchema = z.object({
	object: z.literal("list"),
	data: z.array(ioIntelligenceModelSchema),
})

type IOIntelligenceApiResponse = z.infer<typeof ioIntelligenceApiResponseSchema>

interface CacheEntry {
	data: ModelRecord
	timestamp: number
}

let cache: CacheEntry | null = null

function parseIOIntelligenceModel(model: IOIntelligenceModel): ModelInfo {
	const contextWindow = model.context_window ?? model.max_model_len ?? 8192

	// Use API max_tokens if provided, otherwise calculate 20% of context window
	const maxTokens = model.max_tokens && model.max_tokens > 0 ? model.max_tokens : Math.ceil(contextWindow * 0.2)

	return {
		maxTokens,
		contextWindow,
		supportsImages: model.supports_images_input,
		supportsPromptCache: model.supports_prompt_cache,
		supportsComputerUse: false, // Not supported by IO Intelligence
		inputPrice: parseApiPrice(model.input_token_price),
		outputPrice: parseApiPrice(model.output_token_price),
		cacheWritesPrice: parseApiPrice(model.cache_write_token_price),
		cacheReadsPrice: parseApiPrice(model.cache_read_token_price),
		description: `${model.id} via IO Intelligence`,
	}
}

/**
 * Fetches available models from IO Intelligence
 * <mcreference link="https://docs.io.net/reference/get-started-with-io-intelligence-api" index="1">1</mcreference>
 */
export async function getIOIntelligenceModels(apiKey?: string): Promise<ModelRecord> {
	const now = Date.now()

	if (cache && now - cache.timestamp < IO_INTELLIGENCE_CACHE_DURATION) {
		return cache.data
	}

	const models: ModelRecord = {}

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		// Note: IO Intelligence models endpoint does not require authentication
		// API key is optional for future use if needed
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`
		}

		const response = await axios.get<IOIntelligenceApiResponse>(
			"https://api.intelligence.io.solutions/api/v1/models",
			{
				headers,
				timeout: 10000,
			},
		)

		const result = ioIntelligenceApiResponseSchema.safeParse(response.data)

		if (!result.success) {
			console.error("IO Intelligence models response validation failed:", result.error.format())
			throw new Error("Invalid response format from IO Intelligence API")
		}

		for (const model of result.data.data) {
			models[model.id] = parseIOIntelligenceModel(model)
		}

		cache = { data: models, timestamp: now }

		return models
	} catch (error) {
		console.error("Error fetching IO Intelligence models:", error)

		if (cache) {
			return cache.data
		}

		if (axios.isAxiosError(error)) {
			if (error.response) {
				throw new Error(
					`Failed to fetch IO Intelligence models: ${error.response.status} ${error.response.statusText}`,
				)
			} else if (error.request) {
				throw new Error(
					"Failed to fetch IO Intelligence models: No response from server. Check your internet connection.",
				)
			}
		}

		throw new Error(
			`Failed to fetch IO Intelligence models: ${error instanceof Error ? error.message : "Unknown error"}`,
		)
	}
}

export function getCachedIOIntelligenceModels(): ModelRecord | null {
	return cache?.data || null
}

export function clearIOIntelligenceCache(): void {
	cache = null
}
