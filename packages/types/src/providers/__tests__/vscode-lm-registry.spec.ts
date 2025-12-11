import { findModelInRegistry, mergeModelInfoWithRegistry, VSCODE_LM_MODEL_REGISTRY } from "../vscode-lm-registry.js"

describe("vscode-lm-registry", () => {
	describe("VSCODE_LM_MODEL_REGISTRY", () => {
		test("should have entries", () => {
			expect(VSCODE_LM_MODEL_REGISTRY.length).toBeGreaterThan(0)
		})

		test("should have valid model info for each entry", () => {
			for (const entry of VSCODE_LM_MODEL_REGISTRY) {
				expect(entry.patterns).toBeDefined()
				expect(entry.patterns.length).toBeGreaterThan(0)
				expect(entry.info).toBeDefined()
				expect(entry.info.contextWindow).toBeGreaterThan(0)
			}
		})
	})

	describe("findModelInRegistry", () => {
		test("should find Claude Opus 4.5 with various naming patterns", () => {
			const testCases = [
				"claude-opus-4-5-20251101",
				"anthropic/claude-opus-4.5",
				"copilot-claude-opus-4-5",
				"claude-4-5-opus",
				"CLAUDE_OPUS_4_5",
				"claude@opus@4@5",
			]

			for (const modelId of testCases) {
				const result = findModelInRegistry(modelId)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(200_000)
				expect(result?.maxTokens).toBe(32_000)
				expect(result?.supportsReasoningBudget).toBe(true)
			}
		})

		test("should find Claude Sonnet 4.5 models", () => {
			const testCases = [
				"claude-sonnet-4-5",
				"claude-3-5-sonnet-v2",
				"claude-3.5-sonnet",
				"anthropic/claude-sonnet-3-5",
			]

			for (const modelId of testCases) {
				const result = findModelInRegistry(modelId)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(200_000)
				expect(result?.supportsImages).toBe(true)
			}
		})

		test("should find GPT-4o models", () => {
			const testCases = ["gpt-4o", "gpt-4-omni", "copilot-gpt-4o", "openai/gpt-4o"]

			for (const modelId of testCases) {
				const result = findModelInRegistry(modelId)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(128_000)
				expect(result?.supportsImages).toBe(true)
			}
		})

		test("should find Gemini models", () => {
			const testCases = ["gemini-2.5-pro", "gemini-2-5-pro", "google/gemini-pro-2-5"]

			for (const modelId of testCases) {
				const result = findModelInRegistry(modelId)
				expect(result).not.toBeNull()
				expect(result?.contextWindow).toBe(1_048_576)
			}
		})

		test("should return null for unknown models", () => {
			const result = findModelInRegistry("unknown-model-xyz-123")
			expect(result).toBeNull()
		})

		test("should return null for empty string", () => {
			const result = findModelInRegistry("")
			expect(result).toBeNull()
		})
	})

	describe("mergeModelInfoWithRegistry", () => {
		test("should use registry context window for Claude Opus 4.5 even when API reports less", () => {
			// Simulate GitHub Copilot reporting only 128K for Claude Opus 4.5
			const result = mergeModelInfoWithRegistry("claude-opus-4-5-20251101", 128_000, 100_000)

			expect(result.contextWindow).toBe(200_000) // Should use registry value
			expect(result.maxTokens).toBe(32_000)
			expect(result.supportsReasoningBudget).toBe(true)
		})

		test("should use registry values over API values", () => {
			const result = mergeModelInfoWithRegistry("gpt-4o", 50_000, 100_000)

			expect(result.contextWindow).toBe(128_000) // Registry value, not API's 50K
			expect(result.maxTokens).toBe(16_384)
		})

		test("should use API values when model not in registry", () => {
			const result = mergeModelInfoWithRegistry("custom-unknown-model", 75_000, 100_000)

			expect(result.contextWindow).toBe(75_000) // API value
			expect(result.maxTokens).toBe(-1) // Default unlimited
		})

		test("should use fallback when neither registry nor API provide values", () => {
			const result = mergeModelInfoWithRegistry("unknown-model", undefined, 150_000)

			expect(result.contextWindow).toBe(150_000) // Fallback value
		})

		test("should handle edge case where API reports 0", () => {
			const result = mergeModelInfoWithRegistry("gpt-4o", 0, 100_000)

			// Should use registry value since API reports 0
			expect(result.contextWindow).toBe(128_000)
		})

		test("should preserve all registry capabilities", () => {
			const result = mergeModelInfoWithRegistry("claude-haiku-4-5", 128_000, 100_000)

			expect(result.contextWindow).toBe(200_000)
			expect(result.supportsImages).toBe(false)
			expect(result.supportsPromptCache).toBe(true)
			expect(result.supportsReasoningBudget).toBe(true)
		})
	})

	describe("pattern matching edge cases", () => {
		test("should handle models with vendor prefixes", () => {
			const testCases = [
				"anthropic/claude-opus-4-5",
				"openai/gpt-4o",
				"google/gemini-2.5-pro",
				"copilot-claude-sonnet-4-5",
			]

			for (const modelId of testCases) {
				const result = findModelInRegistry(modelId)
				expect(result).not.toBeNull()
			}
		})

		test("should handle case-insensitive matching", () => {
			const testCases = ["CLAUDE-OPUS-4-5", "Claude-Opus-4-5", "claude_opus_4_5", "GPT-4O", "gpt-4o", "Gpt-4O"]

			for (const modelId of testCases) {
				const result = findModelInRegistry(modelId)
				expect(result).not.toBeNull()
			}
		})

		test("should handle different separator styles", () => {
			const result1 = findModelInRegistry("claude-opus-4-5")
			const result2 = findModelInRegistry("claude_opus_4_5")
			const result3 = findModelInRegistry("claude@opus@4@5")

			expect(result1).not.toBeNull()
			expect(result2).not.toBeNull()
			expect(result3).not.toBeNull()

			// All should return the same model info
			expect(result1?.contextWindow).toBe(result2?.contextWindow)
			expect(result2?.contextWindow).toBe(result3?.contextWindow)
		})
	})
})
