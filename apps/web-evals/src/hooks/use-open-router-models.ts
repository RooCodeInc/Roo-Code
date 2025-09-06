import { z } from "zod"
import { useQuery } from "@tanstack/react-query"

// Extended schema to include context window and pricing information
export const openRouterModelSchema = z.object({
	id: z.string(),
	name: z.string(),
	context_length: z.number().optional(),
	pricing: z
		.object({
			prompt: z.union([z.string(), z.number()]).optional(),
			completion: z.union([z.string(), z.number()]).optional(),
		})
		.optional(),
})

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>

export const getOpenRouterModels = async (): Promise<OpenRouterModel[]> => {
	const response = await fetch("https://openrouter.ai/api/v1/models")

	if (!response.ok) {
		return []
	}

	const result = z.object({ data: z.array(openRouterModelSchema) }).safeParse(await response.json())

	if (!result.success) {
		console.error(result.error)
		return []
	}

	return result.data.data.sort((a, b) => a.name.localeCompare(b.name))
}

export const useOpenRouterModels = () =>
	useQuery({
		queryKey: ["getOpenRouterModels"],
		queryFn: getOpenRouterModels,
		staleTime: 1000 * 60 * 60, // Cache for 1 hour
		gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours (gcTime replaces cacheTime in v5)
	})

// Helper function to get model details by ID
export const getModelDetails = (models: OpenRouterModel[] | undefined, modelId: string) => {
	if (!models) return null
	return models.find((m) => m.id === modelId)
}

// Helper function to convert pricing to per-million tokens
export const getPricingPerMillion = (pricing: OpenRouterModel["pricing"]) => {
	if (!pricing) return { input: undefined, output: undefined }

	const parsePrice = (price: string | number | undefined): number | undefined => {
		if (price === undefined) return undefined
		const numPrice = typeof price === "string" ? parseFloat(price) : price
		if (isNaN(numPrice)) return undefined
		// OpenRouter prices are typically per token, convert to per million
		return numPrice * 1_000_000
	}

	return {
		input: parsePrice(pricing.prompt),
		output: parsePrice(pricing.completion),
	}
}
