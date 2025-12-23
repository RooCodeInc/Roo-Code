// npx vitest run api/providers/utils/__tests__/router-tool-preferences.spec.ts

import type { ModelInfo } from "@roo-code/types"
import { applyRouterToolPreferences } from "../router-tool-preferences"

describe("applyRouterToolPreferences", () => {
	const baseModelInfo: ModelInfo = {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: true,
		supportsPromptCache: false,
	}

	describe("OpenAI models", () => {
		it("should apply codex variant and exclude write_to_file for openai models", () => {
			const result = applyRouterToolPreferences("openai/gpt-4", baseModelInfo)

			expect(result.editToolVariant).toBe("codex")
			expect(result.excludedTools).toContain("write_to_file")
		})

		it("should not override existing editToolVariant for openai models", () => {
			const info: ModelInfo = { ...baseModelInfo, editToolVariant: "gemini" }
			const result = applyRouterToolPreferences("openai/gpt-4", info)

			expect(result.editToolVariant).toBe("gemini")
		})

		it("should preserve existing excludedTools and add write_to_file", () => {
			const info: ModelInfo = { ...baseModelInfo, excludedTools: ["some_tool"] }
			const result = applyRouterToolPreferences("openai/gpt-4", info)

			expect(result.excludedTools).toContain("some_tool")
			expect(result.excludedTools).toContain("write_to_file")
		})

		it("should not duplicate write_to_file in excludedTools", () => {
			const info: ModelInfo = { ...baseModelInfo, excludedTools: ["write_to_file"] }
			const result = applyRouterToolPreferences("openai/gpt-4", info)

			expect(result.excludedTools?.filter((t) => t === "write_to_file").length).toBe(1)
		})
	})

	describe("Gemini models", () => {
		it("should apply gemini variant and include write_file for gemini models", () => {
			const result = applyRouterToolPreferences("google/gemini-2.5-pro", baseModelInfo)

			expect(result.editToolVariant).toBe("gemini")
			expect(result.includedTools).toContain("write_file")
		})

		it("should not override existing editToolVariant for gemini models", () => {
			const info: ModelInfo = { ...baseModelInfo, editToolVariant: "codex" }
			const result = applyRouterToolPreferences("google/gemini-2.5-pro", info)

			expect(result.editToolVariant).toBe("codex")
		})

		it("should preserve existing includedTools and add write_file", () => {
			const info: ModelInfo = { ...baseModelInfo, includedTools: ["some_tool"] }
			const result = applyRouterToolPreferences("google/gemini-2.5-pro", info)

			expect(result.includedTools).toContain("some_tool")
			expect(result.includedTools).toContain("write_file")
		})

		it("should not duplicate write_file in includedTools", () => {
			const info: ModelInfo = { ...baseModelInfo, includedTools: ["write_file"] }
			const result = applyRouterToolPreferences("google/gemini-2.5-pro", info)

			expect(result.includedTools?.filter((t) => t === "write_file").length).toBe(1)
		})
	})

	describe("xAI/Grok models", () => {
		it("should apply grok variant for grok models", () => {
			const result = applyRouterToolPreferences("xai/grok-2", baseModelInfo)

			expect(result.editToolVariant).toBe("grok")
		})

		it("should apply grok variant for models containing xai", () => {
			const result = applyRouterToolPreferences("xai/grok-beta", baseModelInfo)

			expect(result.editToolVariant).toBe("grok")
		})

		it("should not override existing editToolVariant for grok models", () => {
			const info: ModelInfo = { ...baseModelInfo, editToolVariant: "codex" }
			const result = applyRouterToolPreferences("xai/grok-2", info)

			expect(result.editToolVariant).toBe("codex")
		})
	})

	describe("Claude/Anthropic models", () => {
		it("should apply anthropic variant for claude models", () => {
			const result = applyRouterToolPreferences("anthropic/claude-3.5-sonnet", baseModelInfo)

			expect(result.editToolVariant).toBe("anthropic")
		})

		it("should apply anthropic variant for models containing anthropic", () => {
			const result = applyRouterToolPreferences("anthropic/claude-3-opus", baseModelInfo)

			expect(result.editToolVariant).toBe("anthropic")
		})

		it("should apply anthropic variant for models containing claude", () => {
			const result = applyRouterToolPreferences("openrouter/claude-3-haiku", baseModelInfo)

			expect(result.editToolVariant).toBe("anthropic")
		})

		it("should not override existing editToolVariant for claude models", () => {
			const info: ModelInfo = { ...baseModelInfo, editToolVariant: "codex" }
			const result = applyRouterToolPreferences("anthropic/claude-3.5-sonnet", info)

			expect(result.editToolVariant).toBe("codex")
		})
	})

	describe("Unknown models", () => {
		it("should not modify model info for unknown models", () => {
			const result = applyRouterToolPreferences("some-provider/unknown-model", baseModelInfo)

			expect(result).toEqual(baseModelInfo)
		})

		it("should preserve all original properties for unknown models", () => {
			const info: ModelInfo = {
				...baseModelInfo,
				editToolVariant: "roo",
				excludedTools: ["tool1"],
				includedTools: ["tool2"],
			}
			const result = applyRouterToolPreferences("some-provider/unknown-model", info)

			expect(result).toEqual(info)
		})
	})

	describe("Edge cases", () => {
		it("should handle empty modelId", () => {
			const result = applyRouterToolPreferences("", baseModelInfo)

			expect(result).toEqual(baseModelInfo)
		})

		it("should handle modelId with multiple matching patterns (openai takes precedence via order)", () => {
			// This is a contrived case - in reality modelIds wouldn't contain multiple provider names
			const result = applyRouterToolPreferences("openai-gemini-hybrid", baseModelInfo)

			// openai matches first, then gemini adds its modifications
			expect(result.editToolVariant).toBe("codex") // openai sets this first, gemini doesn't override
			expect(result.excludedTools).toContain("write_to_file")
			expect(result.includedTools).toContain("write_file")
		})

		it("should preserve other ModelInfo properties", () => {
			const info: ModelInfo = {
				...baseModelInfo,
				description: "Test model",
				supportsNativeTools: true,
			}
			const result = applyRouterToolPreferences("openai/gpt-4", info)

			expect(result.description).toBe("Test model")
			expect(result.supportsNativeTools).toBe(true)
		})
	})
})
