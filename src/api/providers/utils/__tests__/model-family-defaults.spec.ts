import { ModelInfo } from "@roo-code/types"
import { applyModelFamilyDefaults, MODEL_FAMILY_REGISTRY } from "../model-family-defaults"

describe("model-family-defaults", () => {
	describe("MODEL_FAMILY_REGISTRY", () => {
		it("should have Gemini 3 pattern as first entry (most specific)", () => {
			expect(MODEL_FAMILY_REGISTRY[0].pattern.toString()).toMatch(/gemini-3|gemini\/gemini-3/i)
		})

		it("should have general Gemini pattern after Gemini 3", () => {
			const geminiIndex = MODEL_FAMILY_REGISTRY.findIndex(
				(config) =>
					config.pattern.toString().includes("gemini") && !config.pattern.toString().includes("gemini-3"),
			)
			expect(geminiIndex).toBeGreaterThan(0)
		})

		it("should have OpenAI/GPT pattern", () => {
			const openaiConfig = MODEL_FAMILY_REGISTRY.find((config) => config.pattern.toString().includes("gpt"))
			expect(openaiConfig).toBeDefined()
			expect(openaiConfig!.defaults.includedTools).toContain("apply_patch")
			expect(openaiConfig!.defaults.excludedTools).toContain("apply_diff")
		})
	})

	describe("applyModelFamilyDefaults", () => {
		const baseInfo: ModelInfo = {
			maxTokens: 8192,
			contextWindow: 128000,
			supportsImages: true,
			supportsPromptCache: false,
		}

		describe("Gemini 3 models", () => {
			it("should apply Gemini 3 defaults for gemini-3 model", () => {
				const result = applyModelFamilyDefaults("gemini-3-flash", baseInfo)
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
				expect(result.excludedTools).toEqual(["apply_diff"])
				expect(result.defaultTemperature).toBe(1)
			})

			it("should apply Gemini 3 defaults for google/gemini-3 model", () => {
				const result = applyModelFamilyDefaults("google/gemini-3-pro", baseInfo)
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
				expect(result.excludedTools).toEqual(["apply_diff"])
				expect(result.defaultTemperature).toBe(1)
			})

			it("should NOT override explicit includedTools", () => {
				const infoWithTools: ModelInfo = {
					...baseInfo,
					includedTools: ["custom_tool"],
				}
				const result = applyModelFamilyDefaults("gemini-3-flash", infoWithTools)
				expect(result.includedTools).toEqual(["custom_tool"])
				expect(result.excludedTools).toEqual(["apply_diff"]) // This wasn't set, so default applies
			})

			it("should NOT override explicit excludedTools", () => {
				const infoWithTools: ModelInfo = {
					...baseInfo,
					excludedTools: ["other_tool"],
				}
				const result = applyModelFamilyDefaults("gemini-3-flash", infoWithTools)
				expect(result.excludedTools).toEqual(["other_tool"])
				expect(result.includedTools).toEqual(["write_file", "edit_file"]) // This wasn't set, so default applies
			})

			it("should NOT override explicit defaultTemperature", () => {
				const infoWithTemp: ModelInfo = {
					...baseInfo,
					defaultTemperature: 0.5,
				}
				const result = applyModelFamilyDefaults("gemini-3-flash", infoWithTemp)
				expect(result.defaultTemperature).toBe(0.5)
			})
		})

		describe("General Gemini models", () => {
			it("should apply Gemini defaults for gemini model", () => {
				const result = applyModelFamilyDefaults("gemini-1.5-pro", baseInfo)
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
				expect(result.excludedTools).toEqual(["apply_diff"])
				expect(result.defaultTemperature).toBeUndefined() // General Gemini doesn't set temperature
			})

			it("should apply Gemini defaults for google/gemini model", () => {
				const result = applyModelFamilyDefaults("google/gemini-1.5-flash", baseInfo)
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
				expect(result.excludedTools).toEqual(["apply_diff"])
			})

			it("should apply Gemini defaults for models with gemini in the name", () => {
				const result = applyModelFamilyDefaults("openrouter/google/gemini-pro", baseInfo)
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
				expect(result.excludedTools).toEqual(["apply_diff"])
			})
		})

		describe("OpenAI/GPT models", () => {
			it("should apply OpenAI defaults for gpt-4 model", () => {
				const result = applyModelFamilyDefaults("gpt-4-turbo", baseInfo)
				expect(result.includedTools).toEqual(["apply_patch"])
				expect(result.excludedTools).toEqual(["apply_diff", "write_to_file"])
			})

			it("should apply OpenAI defaults for openai/ prefixed model", () => {
				const result = applyModelFamilyDefaults("openai/gpt-4o", baseInfo)
				expect(result.includedTools).toEqual(["apply_patch"])
				expect(result.excludedTools).toEqual(["apply_diff", "write_to_file"])
			})

			it("should apply OpenAI defaults for o1 model", () => {
				const result = applyModelFamilyDefaults("o1-preview", baseInfo)
				expect(result.includedTools).toEqual(["apply_patch"])
				expect(result.excludedTools).toEqual(["apply_diff", "write_to_file"])
			})

			it("should apply OpenAI defaults for o3-mini model", () => {
				const result = applyModelFamilyDefaults("o3-mini", baseInfo)
				expect(result.includedTools).toEqual(["apply_patch"])
				expect(result.excludedTools).toEqual(["apply_diff", "write_to_file"])
			})

			it("should apply OpenAI defaults for o4 model", () => {
				const result = applyModelFamilyDefaults("o4", baseInfo)
				expect(result.includedTools).toEqual(["apply_patch"])
				expect(result.excludedTools).toEqual(["apply_diff", "write_to_file"])
			})
		})

		describe("Non-matching models", () => {
			it("should return unchanged info for non-matching model", () => {
				const result = applyModelFamilyDefaults("claude-3-opus", baseInfo)
				expect(result).toEqual(baseInfo)
			})

			it("should return unchanged info for anthropic models", () => {
				const result = applyModelFamilyDefaults("anthropic/claude-3.5-sonnet", baseInfo)
				expect(result).toEqual(baseInfo)
			})

			it("should return unchanged info for deepseek models", () => {
				const result = applyModelFamilyDefaults("deepseek-r1", baseInfo)
				expect(result).toEqual(baseInfo)
			})
		})

		describe("Preserving existing properties", () => {
			it("should preserve all original info properties", () => {
				const fullInfo: ModelInfo = {
					maxTokens: 16384,
					contextWindow: 256000,
					supportsImages: true,
					supportsPromptCache: true,
					supportsNativeTools: true,
					inputPrice: 0.01,
					outputPrice: 0.03,
					cacheReadsPrice: 0.005,
					cacheWritesPrice: 0.015,
					description: "Test model",
				}
				const result = applyModelFamilyDefaults("gemini-3-flash", fullInfo)

				// Original properties should be preserved
				expect(result.maxTokens).toBe(16384)
				expect(result.contextWindow).toBe(256000)
				expect(result.supportsImages).toBe(true)
				expect(result.supportsPromptCache).toBe(true)
				expect(result.supportsNativeTools).toBe(true)
				expect(result.inputPrice).toBe(0.01)
				expect(result.outputPrice).toBe(0.03)
				expect(result.cacheReadsPrice).toBe(0.005)
				expect(result.cacheWritesPrice).toBe(0.015)
				expect(result.description).toBe("Test model")

				// Family defaults should be applied
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
				expect(result.excludedTools).toEqual(["apply_diff"])
				expect(result.defaultTemperature).toBe(1)
			})

			it("should not mutate original info object", () => {
				const originalInfo: ModelInfo = {
					maxTokens: 8192,
					contextWindow: 128000,
					supportsImages: false,
					supportsPromptCache: false,
				}
				const originalCopy = { ...originalInfo }

				applyModelFamilyDefaults("gemini-3-flash", originalInfo)

				expect(originalInfo).toEqual(originalCopy)
			})
		})

		describe("First-match-wins behavior", () => {
			it("should use Gemini 3 defaults for gemini-3 (not general Gemini)", () => {
				const result = applyModelFamilyDefaults("gemini-3-flash", baseInfo)
				// Gemini 3 has defaultTemperature: 1, general Gemini doesn't
				expect(result.defaultTemperature).toBe(1)
			})

			it("should use general Gemini defaults for gemini-1.5 (not Gemini 3)", () => {
				const result = applyModelFamilyDefaults("gemini-1.5-pro", baseInfo)
				// General Gemini doesn't have defaultTemperature, so it should be undefined
				expect(result.defaultTemperature).toBeUndefined()
			})
		})

		describe("Case insensitivity", () => {
			it("should match Gemini case-insensitively", () => {
				const result = applyModelFamilyDefaults("GEMINI-1.5-PRO", baseInfo)
				expect(result.includedTools).toEqual(["write_file", "edit_file"])
			})

			it("should match GPT case-insensitively", () => {
				const result = applyModelFamilyDefaults("GPT-4-TURBO", baseInfo)
				expect(result.includedTools).toEqual(["apply_patch"])
			})
		})
	})
})
