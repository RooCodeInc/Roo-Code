import axios from "axios"
import { z } from "zod"

import { type ModelInfo, xaiModels } from "@roo-code/types"
import { DEFAULT_HEADERS } from "../../providers/constants"

/**
 * Schema for GET https://api.x.ai/v1/language-models
 * This endpoint returns rich metadata including modalities and pricing.
 */
const xaiLanguageModelSchema = z.object({
	id: z.string(),
	input_modalities: z.array(z.string()).optional(),
	output_modalities: z.array(z.string()).optional(),
	prompt_text_token_price: z.number().optional(), // fractional cents (basis points) per 1M tokens
	cached_prompt_text_token_price: z.number().optional(), // fractional cents per 1M tokens
	prompt_image_token_price: z.number().optional(), // fractional cents per 1M tokens
	completion_text_token_price: z.number().optional(), // fractional cents per 1M tokens
	search_price: z.number().optional(),
	aliases: z.array(z.string()).optional(),
})

const xaiLanguageModelsResponseSchema = z.object({
	models: z.array(xaiLanguageModelSchema),
})

/**
 * Fetch available xAI models for the authenticated account.
 * - Uses Bearer Authorization header when apiKey is provided
 * - Maps discovered IDs to ModelInfo using static catalog (xaiModels) when possible
 * - For models not in static catalog, contextWindow and maxTokens remain undefined
 */
export async function getXaiModels(apiKey?: string, baseUrl?: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	// Build proper endpoint whether user passes https://api.x.ai or https://api.x.ai/v1
	const base = baseUrl ? baseUrl.replace(/\/+$/, "") : "https://api.x.ai"
	const url = base.endsWith("/v1") ? `${base}/language-models` : `${base}/v1/language-models`

	try {
		const resp = await axios.get(url, {
			headers: {
				...DEFAULT_HEADERS,
				Accept: "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
			},
		})

		const parsed = xaiLanguageModelsResponseSchema.safeParse(resp.data)
		const items = parsed.success
			? parsed.data.models
			: Array.isArray((resp.data as any)?.models)
				? (resp.data as any)?.models
				: []

		if (!parsed.success) {
			console.error("xAI language models response validation failed", parsed.error?.format?.() ?? parsed.error)
		}

		// Helper to convert fractional-cents-per-1M (basis points) to dollars-per-1M
		// The API returns values in 1/100th of a cent, so divide by 10,000 to get dollars
		const centsToDollars = (v?: number) => (typeof v === "number" ? v / 10_000 : undefined)

		for (const m of items) {
			const id = m.id
			const staticInfo = xaiModels[id as keyof typeof xaiModels]
			const supportsImages = Array.isArray(m.input_modalities) ? m.input_modalities.includes("image") : false

			// Cache support is indicated by presence of cached_prompt_text_token_price field (even if 0)
			const supportsPromptCache = typeof m.cached_prompt_text_token_price === "number"
			const cacheReadsPrice = supportsPromptCache ? centsToDollars(m.cached_prompt_text_token_price) : undefined

			const info: ModelInfo = {
				maxTokens: staticInfo?.maxTokens ?? undefined,
				contextWindow: staticInfo?.contextWindow ?? undefined,
				supportsImages,
				supportsPromptCache,
				inputPrice: centsToDollars(m.prompt_text_token_price),
				outputPrice: centsToDollars(m.completion_text_token_price),
				cacheReadsPrice,
				cacheWritesPrice: cacheReadsPrice, // xAI uses same price for reads and writes
				description: staticInfo?.description,
				supportsReasoningEffort:
					staticInfo && "supportsReasoningEffort" in staticInfo
						? staticInfo.supportsReasoningEffort
						: undefined,
				// leave other optional fields undefined unless available via static definitions
			}

			models[id] = info
			// Aliases are not added to the model list to avoid duplication in UI
			// Users should use the primary model ID; xAI API will handle alias resolution
		}
	} catch (error) {
		// Avoid logging sensitive data like Authorization headers
		if (axios.isAxiosError(error)) {
			const status = error.response?.status
			const statusText = error.response?.statusText
			const url = (error as any)?.config?.url
			console.error(`[xAI] models fetch failed: ${status ?? "unknown"} ${statusText ?? ""} ${url ?? ""}`.trim())
		} else {
			console.error("[xAI] models fetch failed.", error instanceof Error ? error.message : String(error))
		}
		throw error
	}

	return models
}
