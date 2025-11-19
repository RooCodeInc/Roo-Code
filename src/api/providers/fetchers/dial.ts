import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"
import { dialDefaultModelInfo } from "@roo-code/types"

import { DEFAULT_HEADERS } from "../constants"
import { normalizeDialBaseUrl } from "../utils/normalize-dial-base-url"

const DialModelSchema = z.object({
	id: z.string(),
	display_name: z.string().optional(),
	description: z.string().optional(),
	defaults: z
		.object({
			max_tokens: z.number().optional(),
			custom_fields: z
				.object({
					configuration: z
						.object({
							thinking: z
								.object({
									budget_tokens: z.number().optional(),
								})
								.optional(),
						})
						.optional(),
				})
				.optional(),
		})
		.optional(),
	limits: z
		.object({
			max_total_tokens: z.number().optional(),
		})
		.optional(),
	input_attachment_types: z.array(z.string()).optional(),
	pricing: z
		.object({
			prompt: z.string().optional(),
			completion: z.string().optional(),
		})
		.optional(),
	features: z
		.object({
			cache: z.boolean().optional(),
			prompt_cache: z.boolean().optional(),
		})
		.optional(),
})

const DialModelsResponseSchema = z.object({ data: z.array(DialModelSchema) })

export async function getDialModels(apiKey: string, baseUrl?: string): Promise<Record<string, ModelInfo>> {
	if (!apiKey) {
		throw new Error("DIAL API key is required to fetch models")
	}

	const headers: Record<string, string> = {
		...DEFAULT_HEADERS,
		"Api-Key": apiKey,
	}

	const normalizedBase = normalizeDialBaseUrl(baseUrl)
	const url = `${normalizedBase}/openai/models`

	const response = await axios.get(url, { headers })
	const parsed = DialModelsResponseSchema.safeParse(response.data)
	const models: Record<string, ModelInfo> = {}

	const data = parsed.success ? parsed.data.data : (response.data?.data ?? [])

	for (const rawModel of data as Array<z.infer<typeof DialModelSchema>>) {
		const contextWindow =
			rawModel.limits?.max_total_tokens ?? rawModel.defaults?.max_tokens ?? dialDefaultModelInfo.contextWindow

		const maxTokens = rawModel.defaults?.max_tokens ?? Math.ceil(contextWindow * 0.2)
		const supportsImages = !!rawModel.input_attachment_types?.some((type) =>
			type.toLowerCase().startsWith("image/"),
		)
		const supportsPromptCache = Boolean(rawModel.features?.cache ?? rawModel.features?.prompt_cache)
		const rawThinkingTokens = rawModel.defaults?.custom_fields?.configuration?.thinking?.budget_tokens
		const normalizedThinkingTokens =
			Number.isFinite(rawThinkingTokens ?? NaN) && (rawThinkingTokens ?? 0) > 0
				? (rawThinkingTokens ?? undefined)
				: undefined
		const supportsReasoningBudget = Boolean(normalizedThinkingTokens)
		const supportsNativeTools = rawModel.features?.tools === true

		const inputPrice = rawModel.pricing?.prompt ? Number.parseFloat(rawModel.pricing.prompt) : undefined
		const outputPrice = rawModel.pricing?.completion ? Number.parseFloat(rawModel.pricing.completion) : undefined

		const info: ModelInfo = {
			...dialDefaultModelInfo,
			contextWindow,
			maxTokens,
			supportsImages,
			supportsPromptCache,
			supportsNativeTools,
			supportsReasoningBudget,
			maxThinkingTokens: normalizedThinkingTokens,
			inputPrice: Number.isFinite(inputPrice || NaN) ? inputPrice : undefined,
			outputPrice: Number.isFinite(outputPrice || NaN) ? outputPrice : undefined,
			description: rawModel.description || rawModel.display_name || dialDefaultModelInfo.description,
		}

		models[rawModel.id] = info
	}

	return models
}
