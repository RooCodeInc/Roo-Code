import { isGlmModel, getGlmModelOptions } from "../glm-model-detection"

describe("GLM Model Detection", () => {
	describe("isGlmModel", () => {
		describe("should detect GLM models", () => {
			const validGlmModels = [
				// Standard Z.ai format
				"glm-4.5",
				"glm-4.6",
				"glm-4.7",
				"glm-4.5-air",
				"glm-4.5v",
				// MLX format (from user's report)
				"mlx-community/GLM-4.5-4bit",
				"mlx-community/GLM-4.5-8bit",
				// GGUF format (from user's report)
				"GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf",
				"GLM-4.5-UD-Q4_K_M.gguf",
				// HuggingFace format
				"THUDM/glm-4-9b-chat",
				"THUDM/glm-4v-9b",
				// ChatGLM variants
				"chatglm-6b",
				"chatglm2-6b",
				"chatglm3-6b",
				"ChatGLM-6B",
				// Without hyphen
				"glm4",
				"GLM4",
				// Mixed case
				"GLM-4.5",
				"Glm-4.5",
			]

			test.each(validGlmModels)('should detect "%s" as a GLM model', (modelId) => {
				expect(isGlmModel(modelId)).toBe(true)
			})
		})

		describe("should NOT detect non-GLM models", () => {
			const nonGlmModels = [
				// OpenAI models
				"gpt-4",
				"gpt-4-turbo",
				"gpt-3.5-turbo",
				"o1-preview",
				// Anthropic models
				"claude-3-opus",
				"claude-3.5-sonnet",
				// Llama models
				"llama-3.1-70b",
				"meta-llama/Llama-3.1-8B-Instruct",
				// Mistral models
				"mistral-7b",
				"mixtral-8x7b",
				// DeepSeek models
				"deepseek-coder",
				"deepseek-reasoner",
				// Qwen models
				"qwen-2.5-72b",
				"qwen-coder",
				// Empty/undefined
				"",
			]

			test.each(nonGlmModels)('should NOT detect "%s" as a GLM model', (modelId) => {
				expect(isGlmModel(modelId)).toBe(false)
			})
		})

		it("should return false for undefined modelId", () => {
			expect(isGlmModel(undefined)).toBe(false)
		})
	})

	describe("getGlmModelOptions", () => {
		it("should return options for GLM models", () => {
			const options = getGlmModelOptions("glm-4.5")
			expect(options).toEqual({
				mergeToolResultText: true,
				disableParallelToolCalls: true,
			})
		})

		it("should return options for MLX GLM models", () => {
			const options = getGlmModelOptions("mlx-community/GLM-4.5-4bit")
			expect(options).toEqual({
				mergeToolResultText: true,
				disableParallelToolCalls: true,
			})
		})

		it("should return options for GGUF GLM models", () => {
			const options = getGlmModelOptions("GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf")
			expect(options).toEqual({
				mergeToolResultText: true,
				disableParallelToolCalls: true,
			})
		})

		it("should return undefined for non-GLM models", () => {
			expect(getGlmModelOptions("gpt-4")).toBeUndefined()
			expect(getGlmModelOptions("llama-3.1")).toBeUndefined()
			expect(getGlmModelOptions("claude-3")).toBeUndefined()
		})

		it("should return undefined for undefined modelId", () => {
			expect(getGlmModelOptions(undefined)).toBeUndefined()
		})

		it("should return undefined for empty string", () => {
			expect(getGlmModelOptions("")).toBeUndefined()
		})
	})
})
