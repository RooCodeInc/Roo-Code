import axios from "axios"
import { z } from "zod"

import { type ModelInfo } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"

// Chutes models endpoint follows OpenAI /models shape
const ChutesModelSchema = z.object({
	id: z.string(),
	object: z.literal("model").optional(),
	owned_by: z.string().optional(),
	created: z.number().optional(),
})

const ChutesModelsResponseSchema = z.object({ data: z.array(ChutesModelSchema) })

export async function getChutesModels(apiKey?: string): Promise<Record<string, ModelInfo>> {
	const headers: Record<string, string> = { ...DEFAULT_HEADERS }
	if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`

	const url = "https://llm.chutes.ai/v1/models"
	const models: Record<string, ModelInfo> = {}

	try {
		const response = await axios.get(url, { headers })
		const parsed = ChutesModelsResponseSchema.safeParse(response.data)
		const data = parsed.success ? parsed.data.data : response.data?.data || []

		for (const m of data as Array<z.infer<typeof ChutesModelSchema>>) {
			// Set reasonable defaults for Chutes models
			// Context window and max tokens can be refined based on actual API responses
			const contextWindow = 128000
			const maxTokens = 32768

			const info: ModelInfo = {
				maxTokens,
				contextWindow,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0,
				outputPrice: 0,
				description: `Chutes AI model: ${m.id}`,
			}

			models[m.id] = info
		}
	} catch (error) {
		console.error(`Error fetching Chutes models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
	}

	return models
}
