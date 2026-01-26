import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"

const KeywordsAIProviderSchema = z.object({
	provider_name: z.string().optional(),
	provider_id: z.string().optional(),
	moderation: z.string().optional(),
	credential_fields: z.array(z.string()).optional(),
})

const KeywordsAIModelSchema = z.object({
	model_name: z.string(),
	max_context_window: z.number(),
	input_cost: z.number(),
	output_cost: z.number(),
	rate_limit: z.number().optional(),
	provider: KeywordsAIProviderSchema.optional(),
})

const KeywordsAIModelsResponseSchema = z.object({
	models: z.array(KeywordsAIModelSchema),
})

export async function getKeywordsAiModels(
	baseUrl: string = "https://api.keywordsai.co/api/",
): Promise<Record<string, ModelInfo>> {
	const url = `${baseUrl.replace(/\/$/, "")}/models/public`
	const models: Record<string, ModelInfo> = {}

	const response = await axios.get(url, { headers: DEFAULT_HEADERS })
	const parsed = KeywordsAIModelsResponseSchema.safeParse(response.data)
	const data = parsed.success ? parsed.data.models : (response.data?.models ?? [])

	for (const m of data as z.infer<typeof KeywordsAIModelSchema>[]) {
		const contextWindow = m.max_context_window ?? 8192
		const maxTokens = Math.ceil(contextWindow * 0.2)

		const info: ModelInfo = {
			maxTokens,
			contextWindow,
			supportsImages: false,
			supportsPromptCache: false,
			inputPrice: m.input_cost,
			outputPrice: m.output_cost,
		}

		models[m.model_name] = info
	}

	return models
}
