import {
	fetchModelInfo,
	mergeModelInfoWithFetched,
	clearModelInfoCache,
	getCacheStats,
} from "../vscode-lm-model-fetcher.js"

// Mock fetch globally
const mockFetch = vi.fn()

describe("vscode-lm-model-fetcher", () => {
	beforeEach(() => {
		clearModelInfoCache()
		mockFetch.mockReset()
		// Ensure global.fetch is reset to the mock each time
		global.fetch = mockFetch
	})

	describe("fetchModelInfo", () => {
		test("should return null for empty model ID", async () => {
			const result = await fetchModelInfo("")
			expect(result).toBeNull()
		})

		test("should fetch Claude Opus 4.5 from Anthropic docs", async () => {
			const result = await fetchModelInfo("claude-opus-4-5-20251101")

			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(200_000)
			expect(result?.maxTokens).toBe(32_000)
			expect(result?.supportsReasoningBudget).toBe(true)
		})

		test("should fetch GPT-4o from OpenAI docs", async () => {
			const result = await fetchModelInfo("gpt-4o")

			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(128_000)
			expect(result?.maxTokens).toBe(16_384)
			expect(result?.supportsImages).toBe(true)
		})

		test("should fetch Gemini from Google docs", async () => {
			const result = await fetchModelInfo("gemini-2.5-pro")

			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(1_048_576)
			expect(result?.maxTokens).toBe(65_536)
		})

		test("should handle various model ID formats", async () => {
			const testCases = [
				"claude-opus-4-5",
				"anthropic/claude-opus-4.5",
				"copilot-claude-opus-4-5",
				"CLAUDE_OPUS_4_5",
			]

			for (const modelId of testCases) {
				const result = await fetchModelInfo(modelId)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(200_000)
			}
		})

		test("should cache results", async () => {
			// First call
			const result1 = await fetchModelInfo("gpt-4o")
			expect(result1?.contextWindow).toBe(128_000)

			// Check cache stats
			const stats1 = getCacheStats()
			expect(stats1.size).toBe(1)
			expect(stats1.entries).toContain("gpt-4o")

			// Second call should use cache
			const result2 = await fetchModelInfo("gpt-4o")
			expect(result2?.contextWindow).toBe(128_000)

			// Cache size should still be 1
			const stats2 = getCacheStats()
			expect(stats2.size).toBe(1)
		})

		test("should try OpenRouter API for unknown models", async () => {
			const mockResponse = {
				data: [
					{
						id: "custom/unknown-model",
						context_length: 150_000,
						max_output_tokens: 10_000,
						architecture: { modality: ["text", "image"] },
					},
				],
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			})

			const result = await fetchModelInfo("unknown-model")

			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(150_000)
			expect(result?.maxTokens).toBe(10_000)
			expect(result?.supportsImages).toBe(true)
		})

		test("should return null for completely unknown models", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
			})

			const result = await fetchModelInfo("xyz-completely-unknown-123")
			expect(result).toBeNull()
		})

		test("should handle OpenRouter API failures gracefully", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"))

			// Should still find Claude in docs
			const result = await fetchModelInfo("claude-sonnet-4-5")
			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(200_000)
		})
	})

	describe("mergeModelInfoWithFetched", () => {
		test("should use fetched context window over API value", async () => {
			// API reports 128K, but fetched info knows it's 200K
			const result = await mergeModelInfoWithFetched("claude-opus-4-5", 128_000, 100_000)

			expect(result.contextWindow).toBe(200_000)
			expect(result.maxTokens).toBe(32_000)
		})

		test("should use API value when no fetched data available", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
			})

			const result = await mergeModelInfoWithFetched("completely-unknown", 75_000, 100_000)

			expect(result.contextWindow).toBe(75_000) // Uses API value
			expect(result.maxTokens).toBe(-1) // Default unlimited
		})

		test("should use fallback when neither fetched nor API provide values", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [] }),
			})

			const result = await mergeModelInfoWithFetched("unknown", undefined, 150_000)

			expect(result.contextWindow).toBe(150_000) // Uses fallback
		})

		test("should preserve all fetched capabilities", async () => {
			const result = await mergeModelInfoWithFetched("claude-haiku-4-5", 128_000, 100_000)

			expect(result.contextWindow).toBe(200_000)
			expect(result.supportsImages).toBe(false)
			expect(result.supportsPromptCache).toBe(true)
			expect(result.supportsReasoningBudget).toBe(true)
		})
	})

	describe("cache management", () => {
		test("should clear cache", async () => {
			await fetchModelInfo("gpt-4o")
			await fetchModelInfo("claude-opus-4-5")

			expect(getCacheStats().size).toBe(2)

			clearModelInfoCache()

			expect(getCacheStats().size).toBe(0)
			expect(getCacheStats().entries).toEqual([])
		})

		test("should track cache entries", async () => {
			await fetchModelInfo("gpt-4o")
			await fetchModelInfo("claude-sonnet-4-5")
			await fetchModelInfo("gemini-2.5-pro")

			const stats = getCacheStats()
			expect(stats.size).toBe(3)
			expect(stats.entries).toContain("gpt-4o")
			expect(stats.entries).toContain("claude-sonnet-4-5")
			expect(stats.entries).toContain("gemini-2.5-pro")
		})
	})

	describe("model normalization", () => {
		test("should handle different separator styles", async () => {
			const variants = [
				"claude-opus-4-5",
				"claude_opus_4_5",
				"claude.opus.4.5",
				"claude@opus@4@5",
				"anthropic/claude-opus-4-5",
			]

			for (const variant of variants) {
				const result = await fetchModelInfo(variant)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(200_000)
			}
		})

		test("should be case-insensitive", async () => {
			const variants = ["GPT-4O", "gpt-4o", "Gpt-4O", "GPT_4O"]

			for (const variant of variants) {
				const result = await fetchModelInfo(variant)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(128_000)
			}
		})
	})

	describe("priority ordering", () => {
		test("should check provider-specific docs before OpenRouter", async () => {
			// Claude models should be found in Anthropic docs (priority 1)
			// before trying OpenRouter (priority 4)
			const result = await fetchModelInfo("claude-opus-4-5")

			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(200_000)

			// OpenRouter API should not have been called
			expect(global.fetch).not.toHaveBeenCalled()
		})

		test("should fall back to OpenRouter for unknown providers", async () => {
			const mockResponse = {
				data: [
					{
						id: "meta-llama/llama-3-70b",
						context_length: 8_192,
						max_output_tokens: 4_096,
					},
				],
			}

			mockFetch.mockImplementation(async () => ({
				ok: true,
				json: async () => mockResponse,
			}))

			const result = await fetchModelInfo("llama-3-70b")

			expect(global.fetch).toHaveBeenCalled()
			expect(result).not.toBeNull()
			expect(result?.contextWindow).toBe(8_192)
		})
	})
})
