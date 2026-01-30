import { describe, it, expect } from "vitest"
import { detectGlmModel, type GlmModelConfig, type GlmVersion, type GlmVariant } from "../glm-model-detection"
import { ZAI_DEFAULT_TEMPERATURE } from "@roo-code/types"

describe("GLM Model Detection", () => {
	describe("detectGlmModel", () => {
		describe("when model ID is undefined or empty", () => {
			it("should return non-GLM config for undefined", () => {
				const result = detectGlmModel(undefined)
				expect(result.isGlm).toBe(false)
			})

			it("should return non-GLM config for empty string", () => {
				const result = detectGlmModel("")
				expect(result.isGlm).toBe(false)
			})
		})

		describe("when model ID is not a GLM model", () => {
			it("should return non-GLM config for non-GLM models", () => {
				const nonGlmModels = [
					"gpt-4",
					"gpt-4-turbo",
					"claude-3-opus",
					"llama-3.1-70b",
					"deepseek-coder",
					"qwen-2.5",
				]

				for (const modelId of nonGlmModels) {
					const result = detectGlmModel(modelId)
					expect(result.isGlm).toBe(false)
					expect(result.temperature).toBe(0)
					expect(result.mergeToolResultText).toBe(false)
					expect(result.disableParallelToolCalls).toBe(false)
				}
			})
		})

		describe("GLM-4.5 models", () => {
			it("should detect glm-4.5 base model", () => {
				const result = detectGlmModel("glm-4.5")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("base")
				expect(result.displayName).toBe("GLM-4.5")
				expect(result.supportsVision).toBe(false)
				expect(result.supportsThinking).toBe(false)
				expect(result.temperature).toBe(ZAI_DEFAULT_TEMPERATURE)
				expect(result.mergeToolResultText).toBe(true)
				expect(result.disableParallelToolCalls).toBe(true)
			})

			it("should detect glm-4.5-air variant", () => {
				const result = detectGlmModel("glm-4.5-air")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("air")
				expect(result.displayName).toBe("GLM-4.5-Air")
			})

			it("should detect glm-4.5-airx variant", () => {
				const result = detectGlmModel("glm-4.5-airx")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("airx")
				expect(result.displayName).toBe("GLM-4.5-AirX")
			})

			it("should detect glm-4.5-x variant", () => {
				const result = detectGlmModel("glm-4.5-x")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("x")
				expect(result.displayName).toBe("GLM-4.5-X")
			})

			it("should detect glm-4.5-flash variant", () => {
				const result = detectGlmModel("glm-4.5-flash")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("flash")
				expect(result.displayName).toBe("GLM-4.5-Flash")
			})

			it("should detect glm-4.5v vision variant", () => {
				const result = detectGlmModel("glm-4.5v")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("v")
				expect(result.displayName).toBe("GLM-4.5V")
				expect(result.supportsVision).toBe(true)
			})
		})

		describe("GLM-4.6 models", () => {
			it("should detect glm-4.6 base model", () => {
				const result = detectGlmModel("glm-4.6")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.6")
				expect(result.variant).toBe("base")
				expect(result.displayName).toBe("GLM-4.6")
				expect(result.supportsThinking).toBe(true)
			})

			it("should detect glm-4.6v vision variant", () => {
				const result = detectGlmModel("glm-4.6v")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.6")
				expect(result.variant).toBe("v")
				expect(result.displayName).toBe("GLM-4.6V")
				expect(result.supportsVision).toBe(true)
				expect(result.supportsThinking).toBe(true)
			})

			it("should detect glm-4.6v-flash variant", () => {
				const result = detectGlmModel("glm-4.6v-flash")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.6")
				expect(result.variant).toBe("v-flash")
				expect(result.displayName).toBe("GLM-4.6V-Flash")
				expect(result.supportsVision).toBe(true)
			})

			it("should detect glm-4.6v-flashx variant", () => {
				const result = detectGlmModel("glm-4.6v-flashx")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.6")
				expect(result.variant).toBe("v-flashx")
				expect(result.displayName).toBe("GLM-4.6V-FlashX")
				expect(result.supportsVision).toBe(true)
			})
		})

		describe("GLM-4.7 models", () => {
			it("should detect glm-4.7 base model", () => {
				const result = detectGlmModel("glm-4.7")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.7")
				expect(result.variant).toBe("base")
				expect(result.displayName).toBe("GLM-4.7")
				expect(result.supportsThinking).toBe(true)
			})

			it("should detect glm-4.7-flash variant", () => {
				const result = detectGlmModel("glm-4.7-flash")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.7")
				expect(result.variant).toBe("flash")
				expect(result.displayName).toBe("GLM-4.7-Flash")
			})

			it("should detect glm-4.7-flashx variant", () => {
				const result = detectGlmModel("glm-4.7-flashx")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.7")
				expect(result.variant).toBe("flashx")
				expect(result.displayName).toBe("GLM-4.7-FlashX")
			})
		})

		describe("LM Studio / GGUF format detection", () => {
			it("should detect GLM from GGUF filename", () => {
				const result = detectGlmModel("GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
				expect(result.variant).toBe("base")
			})

			it("should detect GLM from mlx-community path", () => {
				const result = detectGlmModel("mlx-community/GLM-4.5-4bit")
				expect(result.isGlm).toBe(true)
				expect(result.version).toBe("4.5")
			})

			it("should detect GLM with different separators", () => {
				const modelIds = [
					"glm-4.5",
					"glm_4.5",
					"GLM-4.5",
					"GLM_4.5",
					"glm4.5",
					"GLM4.5",
				]

				for (const modelId of modelIds) {
					const result = detectGlmModel(modelId)
					expect(result.isGlm).toBe(true)
					expect(result.version).toBe("4.5")
				}
			})
		})

		describe("case insensitivity", () => {
			it("should detect GLM regardless of case", () => {
				const modelIds = [
					"GLM-4.5",
					"glm-4.5",
					"Glm-4.5",
					"gLm-4.5",
				]

				for (const modelId of modelIds) {
					const result = detectGlmModel(modelId)
					expect(result.isGlm).toBe(true)
				}
			})
		})

		describe("GLM model settings", () => {
			it("should always apply GLM-specific settings for detected models", () => {
				const glmModels = [
					"glm-4.5",
					"glm-4.6",
					"glm-4.7",
					"glm-4.5-air",
					"glm-4.6v",
					"glm-4.7-flash",
				]

				for (const modelId of glmModels) {
					const result = detectGlmModel(modelId)
					expect(result.isGlm).toBe(true)
					expect(result.temperature).toBe(ZAI_DEFAULT_TEMPERATURE)
					expect(result.mergeToolResultText).toBe(true)
					expect(result.disableParallelToolCalls).toBe(true)
				}
			})
		})
	})
})
