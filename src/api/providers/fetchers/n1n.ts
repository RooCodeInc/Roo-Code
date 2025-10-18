import axios from "axios"
import { z } from "zod"

import { type ModelInfo, N1N_BASE_URL } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"

// n1n models endpoint follows OpenAI /models shape
const N1nModelSchema = z.object({
	id: z.string(),
	object: z.literal("model").optional(),
	owned_by: z.string().optional(),
	created: z.number().optional(),
})

const N1nModelsResponseSchema = z.object({
	data: z.array(N1nModelSchema).optional(),
	object: z.string().optional(),
})

export async function getN1nModels(apiKey: string): Promise<Record<string, ModelInfo>> {
	const headers: Record<string, string> = {
		...DEFAULT_HEADERS,
		Authorization: `Bearer ${apiKey}`,
	}

	const url = `${N1N_BASE_URL}/models`
	const models: Record<string, ModelInfo> = {}

	try {
		const response = await axios.get(url, { headers })
		const parsed = N1nModelsResponseSchema.safeParse(response.data)
		const data = parsed.success ? parsed.data.data || [] : response.data?.data || []

		for (const m of data as Array<z.infer<typeof N1nModelSchema>>) {
			// Default model info - n1n doesn't provide detailed metadata in /models endpoint
			// These are conservative defaults that should work for most models
			const info: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 16384,
				supportsImages: false, // Will be true for vision models like gpt-4-vision
				supportsPromptCache: false,
				// n1n doesn't expose pricing via API, would need to be hardcoded or fetched separately
				inputPrice: undefined,
				outputPrice: undefined,
			}

			// Check for known vision model patterns
			if (m.id.includes("vision") || m.id.includes("gpt-4o") || m.id.includes("claude-3")) {
				info.supportsImages = true
			}

			// Check for known models with larger contexts
			if (m.id.includes("gpt-4-turbo") || m.id.includes("claude-3") || m.id.includes("gpt-4o")) {
				info.contextWindow = 128000
				info.maxTokens = 4096
			} else if (m.id.includes("claude-2")) {
				info.contextWindow = 100000
				info.maxTokens = 4096
			} else if (m.id.includes("gpt-3.5-turbo-16k")) {
				info.contextWindow = 16384
				info.maxTokens = 4096
			}

			models[m.id] = info
		}

		return models
	} catch (error) {
		console.error("Error fetching n1n models:", error)
		// Return empty object on error - the handler will use default model
		return {}
	}
}
