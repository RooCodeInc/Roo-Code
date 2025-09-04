import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"

import { parseApiPrice } from "../../../shared/cost"

/**
 * DeepInfra Model Schema
 */
const deepInfraModelSchema = z.object({
	model_name: z.string(),
	type: z.string().optional(),
	max_tokens: z.number().optional(),
	context_length: z.number().optional(),
	pricing: z
		.object({
			input: z.number().optional(),
			output: z.number().optional(),
			cached_input: z.number().optional(),
		})
		.optional(),
	description: z.string().optional(),
	capabilities: z.array(z.string()).optional(),
})

type DeepInfraModel = z.infer<typeof deepInfraModelSchema>

/**
 * DeepInfra Models Response Schema
 */
const deepInfraModelsResponseSchema = z.array(deepInfraModelSchema)

type DeepInfraModelsResponse = z.infer<typeof deepInfraModelsResponseSchema>

/**
 * Fetch models from DeepInfra API
 */
export async function getDeepInfraModels(apiKey?: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = "https://api.deepinfra.com/v1/openai"

	try {
		// DeepInfra requires authentication to fetch models
		if (!apiKey) {
			console.log("DeepInfra API key not provided, returning empty models")
			return models
		}

		const response = await axios.get<DeepInfraModelsResponse>(`${baseURL}/models`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		})

		const result = deepInfraModelsResponseSchema.safeParse(response.data)
		const data = result.success ? result.data : response.data

		if (!result.success) {
			console.error("DeepInfra models response is invalid", result.error.format())
		}

		// Process each model from the response
		for (const model of data) {
			// Skip non-text models
			if (model.type && !["text", "chat", "instruct"].includes(model.type)) {
				continue
			}

			const modelInfo: ModelInfo = {
				maxTokens: model.max_tokens || 4096,
				contextWindow: model.context_length || 32768,
				supportsImages: model.capabilities?.includes("vision") || false,
				supportsPromptCache: true, // DeepInfra supports prompt caching
				inputPrice: model.pricing?.input ? model.pricing.input / 1000000 : 0.15, // Convert from per million to per token
				outputPrice: model.pricing?.output ? model.pricing.output / 1000000 : 0.6,
				cacheReadsPrice: model.pricing?.cached_input ? model.pricing.cached_input / 1000000 : undefined,
				description: model.description,
			}

			models[model.model_name] = modelInfo
		}

		// If the API doesn't return models, provide some default popular models
		if (Object.keys(models).length === 0) {
			console.log("No models returned from DeepInfra API, using default models")

			// Default popular models on DeepInfra
			models["meta-llama/Llama-3.3-70B-Instruct"] = {
				maxTokens: 8192,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0.35 / 1000000,
				outputPrice: 0.4 / 1000000,
				cacheReadsPrice: 0.175 / 1000000,
				description: "Meta Llama 3.3 70B Instruct model",
			}

			models["meta-llama/Llama-3.1-8B-Instruct"] = {
				maxTokens: 4096,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0.06 / 1000000,
				outputPrice: 0.06 / 1000000,
				cacheReadsPrice: 0.03 / 1000000,
				description: "Meta Llama 3.1 8B Instruct model",
			}

			models["Qwen/Qwen2.5-72B-Instruct"] = {
				maxTokens: 8192,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0.35 / 1000000,
				outputPrice: 0.4 / 1000000,
				cacheReadsPrice: 0.175 / 1000000,
				description: "Qwen 2.5 72B Instruct model",
			}

			models["mistralai/Mixtral-8x7B-Instruct-v0.1"] = {
				maxTokens: 4096,
				contextWindow: 32768,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0.24 / 1000000,
				outputPrice: 0.24 / 1000000,
				cacheReadsPrice: 0.12 / 1000000,
				description: "Mistral Mixtral 8x7B Instruct model",
			}
		}
	} catch (error) {
		console.error(`Error fetching DeepInfra models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)

		// Return default models on error
		models["meta-llama/Llama-3.3-70B-Instruct"] = {
			maxTokens: 8192,
			contextWindow: 131072,
			supportsImages: false,
			supportsPromptCache: true,
			inputPrice: 0.35 / 1000000,
			outputPrice: 0.4 / 1000000,
			cacheReadsPrice: 0.175 / 1000000,
			description: "Meta Llama 3.3 70B Instruct model",
		}
	}

	return models
}
