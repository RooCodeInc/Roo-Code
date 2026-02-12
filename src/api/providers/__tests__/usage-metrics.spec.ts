import { normalizeProviderUsage } from "../utils/normalize-provider-usage"

const baseModelInfo = {
	maxTokens: 200_000,
	contextWindow: 200_000,
	supportsPromptCache: true,
	inputPrice: 1,
	outputPrice: 2,
	cacheWritesPrice: 1.25,
	cacheReadsPrice: 0.1,
} as any

describe("normalizeProviderUsage", () => {
	it("normalizes Anthropic-style usage with both total and non-cached semantics", () => {
		const normalized = normalizeProviderUsage({
			provider: "anthropic",
			apiProtocol: "anthropic",
			usage: {
				inputTokens: 13_011,
				outputTokens: 90,
			},
			providerMetadata: {
				anthropic: {
					usage: {
						input_tokens: 3,
						cache_creation_input_tokens: 458,
						cache_read_input_tokens: 12_550,
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.inputTokens).toBe(13_011)
		expect(normalized.chunk.nonCachedInputTokens).toBe(3)
		expect(normalized.chunk.cacheWriteTokens).toBe(458)
		expect(normalized.chunk.cacheReadTokens).toBe(12_550)
		expect(normalized.chunk.outputTokens).toBe(90)
	})

	it("applies precedence policy: providerMetadata > usage > raw", () => {
		const normalized = normalizeProviderUsage({
			provider: "openai",
			apiProtocol: "openai",
			usage: {
				inputTokens: 1000,
				outputTokens: 100,
				inputTokenDetails: {
					cacheReadTokens: 400,
					cacheWriteTokens: 120,
				},
				raw: {
					input_tokens_details: {
						cached_tokens: 700,
					},
					cache_creation_input_tokens: 350,
				},
			},
			providerMetadata: {
				openai: {
					cachedPromptTokens: 500,
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.cacheReadTokens).toBe(500)
		expect(normalized.chunk.cacheWriteTokens).toBe(120)
	})

	it("derives non-cached tokens from total-cache when needed", () => {
		const normalized = normalizeProviderUsage({
			provider: "openai",
			apiProtocol: "openai",
			usage: {
				inputTokens: 100,
				outputTokens: 50,
				inputTokenDetails: {
					cacheReadTokens: 20,
					cacheWriteTokens: 10,
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.inputTokens).toBe(100)
		expect(normalized.chunk.nonCachedInputTokens).toBe(70)
	})

	it("supports array-based metadata extraction (Gemini cacheTokensDetails)", () => {
		const normalized = normalizeProviderUsage({
			provider: "gemini",
			apiProtocol: "openai",
			usage: {
				inputTokens: 500,
				outputTokens: 40,
			},
			providerMetadata: {
				google: {
					usageMetadata: {
						cacheTokensDetails: [{ tokenCount: 20 }, { tokenCount: 30 }],
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.cacheReadTokens).toBe(50)
	})

	it("supports dynamic protocol for vercel-ai-gateway profile", () => {
		const normalized = normalizeProviderUsage({
			provider: "vercel-ai-gateway",
			apiProtocol: "anthropic",
			usage: {
				inputTokens: 13_011,
				outputTokens: 90,
			},
			providerMetadata: {
				anthropic: {
					usage: {
						input_tokens: 3,
						cache_creation_input_tokens: 458,
						cache_read_input_tokens: 12_550,
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.nonCachedInputTokens).toBe(3)
		expect(normalized.chunk.cacheWriteTokens).toBe(458)
		expect(normalized.chunk.cacheReadTokens).toBe(12_550)
	})

	it("coerces string values and omits zero caches by default", () => {
		const normalized = normalizeProviderUsage({
			provider: "openai",
			apiProtocol: "openai",
			usage: {
				inputTokens: "42",
				outputTokens: "7",
				inputTokenDetails: {
					cacheReadTokens: "0",
					cacheWriteTokens: "0",
				},
			} as any,
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.inputTokens).toBe(42)
		expect(normalized.chunk.outputTokens).toBe(7)
		expect(normalized.chunk.cacheReadTokens).toBeUndefined()
		expect(normalized.chunk.cacheWriteTokens).toBeUndefined()
	})

	it("parses OpenRouter-style prompt_tokens_details from raw usage", () => {
		const normalized = normalizeProviderUsage({
			provider: "openrouter",
			apiProtocol: "openai",
			usage: {
				inputTokens: 13_026,
				outputTokens: 147,
				raw: {
					prompt_tokens_details: {
						cached_tokens: 12_547,
						cache_write_tokens: 470,
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.inputTokens).toBe(13_026)
		expect(normalized.chunk.cacheReadTokens).toBe(12_547)
		expect(normalized.chunk.cacheWriteTokens).toBe(470)
		expect(normalized.chunk.nonCachedInputTokens).toBe(9)
	})

	it("parses cache write/read tokens from prompt_tokens_details for anthropic protocol", () => {
		const normalized = normalizeProviderUsage({
			provider: "anthropic",
			apiProtocol: "anthropic",
			usage: {
				inputTokens: 13_026,
				outputTokens: 147,
				raw: {
					prompt_tokens_details: {
						cached_tokens: 12_547,
						cache_write_tokens: 470,
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.cacheReadTokens).toBe(12_547)
		expect(normalized.chunk.cacheWriteTokens).toBe(470)
		expect(normalized.chunk.nonCachedInputTokens).toBe(9)
	})

	it("parses reasoning tokens from completion_tokens_details", () => {
		const normalized = normalizeProviderUsage({
			provider: "openrouter",
			apiProtocol: "openai",
			usage: {
				inputTokens: 100,
				outputTokens: 30,
				raw: {
					completion_tokens_details: {
						reasoning_tokens: 7,
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.reasoningTokens).toBe(7)
	})

	it("uses usage/raw cost candidates when provider metadata cost is absent", () => {
		const normalized = normalizeProviderUsage({
			provider: "openrouter",
			apiProtocol: "openai",
			usage: {
				inputTokens: 100,
				outputTokens: 20,
				cost: 0.12345 as any,
				raw: {
					cost: 0.98765,
				},
			} as any,
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.totalCost).toBe(0.12345)
	})

	it("falls back to prompt/completion token totals from raw usage", () => {
		const normalized = normalizeProviderUsage({
			provider: "openrouter",
			apiProtocol: "openai",
			usage: {
				raw: {
					prompt_tokens: 200,
					completion_tokens: 30,
					prompt_tokens_details: {
						cached_tokens: 100,
						cache_write_tokens: 50,
					},
				},
			},
			modelInfo: baseModelInfo,
		})

		expect(normalized.chunk.inputTokens).toBe(200)
		expect(normalized.chunk.outputTokens).toBe(30)
		expect(normalized.chunk.cacheReadTokens).toBe(100)
		expect(normalized.chunk.cacheWriteTokens).toBe(50)
		expect(normalized.chunk.nonCachedInputTokens).toBe(50)
	})
})
