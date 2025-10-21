import axios from "axios"
import { z } from "zod"
import type { ModelInfo } from "@roo-code/types"

// Helicone Public Model Registry schemas
const heliconePricingSchema = z.object({
	prompt: z.number().optional(),
	completion: z.number().optional(),
	cacheRead: z.number().optional(),
	cacheWrite: z.number().optional(),
})

const heliconeEndpointSchema = z.object({
	provider: z.string().optional(),
	providerSlug: z.string().optional(),
	supportsPtb: z.boolean().optional(),
	pricing: heliconePricingSchema.optional(),
})

const heliconeModelSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	author: z.string().optional(),
	contextLength: z.number().optional(),
	maxOutput: z.number().optional(),
	description: z.string().optional(),
	inputModalities: z.array(z.string().nullable()).nullable().optional(),
	outputModalities: z.array(z.string().nullable()).nullable().optional(),
	supportedParameters: z.array(z.string().nullable()).nullable().optional(),
	endpoints: z.array(heliconeEndpointSchema).default([]),
})

const heliconeModelsResponseSchema = z.object({
	models: z.array(heliconeModelSchema),
	total: z.number().optional(),
})

export async function getHeliconeModels(): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		// Public model registry (no auth required)
		const url = "https://api.helicone.ai/v1/public/model-registry/models"
		const resp = await axios.get(url)
		const parsed = heliconeModelsResponseSchema.safeParse(resp.data.data)
		const data = parsed.success ? parsed.data?.models : resp.data?.data?.models || []

		if (!parsed.success) {
			console.error("Helicone models response is invalid", parsed.error.format())
		}

		for (const m of data) {
			const model = heliconeModelSchema.parse(m)

			const contextLength = model.contextLength ?? 128_000
			const maxTokens = model.maxOutput ?? Math.ceil(contextLength * 0.2)
			const inputMods = (model.inputModalities || []).filter((mod): mod is string => typeof mod === "string")

			// Find the first PTB-enabled endpoint for pricing
			const ptbEndpoint = model.endpoints.find((ep) => ep.supportsPtb === true)
			if (!ptbEndpoint) continue

			const info: ModelInfo = {
				maxTokens,
				contextWindow: contextLength,
				supportsImages: inputMods.includes("image"),
				supportsPromptCache: true,
				inputPrice: ptbEndpoint.pricing?.prompt,
				outputPrice: ptbEndpoint.pricing?.completion,
				cacheWritesPrice: ptbEndpoint.pricing?.cacheWrite,
				cacheReadsPrice: ptbEndpoint.pricing?.cacheRead,
				description: model.description,
			}

			models[model.id] = info
		}
	} catch (error) {
		console.error(
			`Error fetching Helicone models: ${JSON.stringify(error, Object.getOwnPropertyNames(error as any), 2)}`,
		)
	}

	return models
}
