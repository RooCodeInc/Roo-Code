import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"

import { parseApiPrice } from "../../../shared/cost"

/**
 * CognimaModel
 */

const cognimaModelSchema = z.object({
	id: z.string(),
	owned_by: z.string(),
	object: z.string(),
	created: z.number().optional(),
	updated: z.number().optional(),
})

export type CognimaModel = z.infer<typeof cognimaModelSchema>

/**
 * CognimaModelsResponse
 */

const cognimaModelsResponseSchema = z.object({
	data: z.array(cognimaModelSchema),
	object: z.string(),
})

type CognimaModelsResponse = z.infer<typeof cognimaModelsResponseSchema>

/**
 * getCognimaModels
 */

export async function getCognimaModels(apiKey?: string, baseUrl?: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = baseUrl || "https://cog2.cognima.com.br/openai/v1"

	try {
		const response = await axios.get<CognimaModelsResponse>(`${baseURL}/models`, {
			headers: {
				Authorization: `Bearer ${apiKey || "not-provided"}`,
				"Content-Type": "application/json",
			},
		})

		const result = cognimaModelsResponseSchema.safeParse(response.data)
		const data = result.success ? result.data.data : response.data.data

		if (!result.success) {
			console.error("Cognima models response is invalid", result.error.format())
		}

		for (const model of data) {
			models[model.id] = parseCognimaModel(model)
		}
	} catch (error) {
		console.error(
			`Error fetching Cognima models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * parseCognimaModel
 */

const parseCognimaModel = (model: CognimaModel): ModelInfo => {
	// Provide basic ModelInfo with default values since Cognima API doesn't provide detailed pricing/info
	// These defaults can be adjusted based on the actual models available
	const modelInfo: ModelInfo = {
		maxTokens: 4096, // Default value, can be adjusted per model if needed
		contextWindow: 128000, // Default value, can be adjusted per model if needed
		supportsImages: false, // Default to false, can be determined by model id patterns
		supportsPromptCache: false, // Default to false
		inputPrice: 0, // Default pricing, should be determined by actual API response or config
		outputPrice: 0, // Default pricing, should be determined by actual API response or config
		supportsTemperature: true,
	}

	// Add model-specific overrides based on ID patterns
	if (model.id.includes("gpt-4o")) {
		modelInfo.maxTokens = 16384
		modelInfo.contextWindow = 128000
		modelInfo.supportsImages = true
		modelInfo.inputPrice = 2.5
		modelInfo.outputPrice = 10
	} else if (model.id.includes("gpt-4o-mini")) {
		modelInfo.maxTokens = 16384
		modelInfo.contextWindow = 128000
		modelInfo.supportsImages = true
		modelInfo.inputPrice = 0.15
		modelInfo.outputPrice = 0.6
	} else if (model.id.includes("claude-3-5-sonnet")) {
		modelInfo.maxTokens = 8192
		modelInfo.contextWindow = 200000
		modelInfo.supportsImages = true
		modelInfo.inputPrice = 3.0
		modelInfo.outputPrice = 15.0
	} else if (model.id.includes("llama-3.1-70b")) {
		modelInfo.maxTokens = 4096
		modelInfo.contextWindow = 128000
		modelInfo.supportsImages = false
		modelInfo.inputPrice = 0.52
		modelInfo.outputPrice = 0.75
	}

	return modelInfo
}