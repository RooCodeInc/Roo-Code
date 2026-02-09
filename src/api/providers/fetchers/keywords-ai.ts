import axios from "axios"

import type { ModelInfo } from "@roo-code/types"

import { parseApiPrice } from "../../../shared/cost"

const KEYWORDS_AI_DEFAULT_BASE_URL = "https://api.keywordsai.co/api"

export async function getKeywordsAiModels(apiKey?: string, baseUrl?: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		const headers: Record<string, string> = {}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const resolvedBaseUrl = baseUrl || KEYWORDS_AI_DEFAULT_BASE_URL
		const modelsUrl = new URL("v1/models", resolvedBaseUrl)

		const response = await axios.get(modelsUrl.toString(), { headers })
		const rawModels = response.data.data

		for (const rawModel of rawModels) {
			// Determine reasoning capabilities based on model ID
			const reasoningBudget =
				rawModel.supports_reasoning && (rawModel.id.includes("claude") || rawModel.id.includes("gemini-2.5"))
			const reasoningEffort =
				rawModel.supports_reasoning &&
				(rawModel.id.includes("openai") ||
					rawModel.id.includes("gpt") ||
					rawModel.id.includes("o1") ||
					rawModel.id.includes("o3"))

			const modelInfo: ModelInfo = {
				maxTokens: rawModel.max_output_tokens || rawModel.max_tokens,
				contextWindow: rawModel.context_window || rawModel.context_length,
				supportsPromptCache: rawModel.supports_caching || false,
				supportsImages: rawModel.supports_vision || false,
				supportsReasoningBudget: reasoningBudget,
				supportsReasoningEffort: reasoningEffort,
				inputPrice: parseApiPrice(rawModel.input_price || rawModel.input_cost),
				outputPrice: parseApiPrice(rawModel.output_price || rawModel.output_cost),
				description: rawModel.description,
				cacheWritesPrice: parseApiPrice(rawModel.caching_price || rawModel.cache_write_price),
				cacheReadsPrice: parseApiPrice(rawModel.cached_price || rawModel.cache_read_price),
			}

			models[rawModel.id] = modelInfo
		}
	} catch (error) {
		console.error(
			`Error fetching Keywords AI models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}
