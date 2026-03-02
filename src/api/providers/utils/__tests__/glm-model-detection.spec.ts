import { isGlmModel, isGlm47Plus, getGlmModelOptions } from "../glm-model-detection"

describe("GLM Model Detection", () => {
	describe("isGlmModel", () => {
		describe("should detect GLM models", () => {
			const validGlmModels = [
				// Standard Z.ai format
				"glm-4.5",
				"glm-4.6",
				"glm-4.7",
				"glm-4.7-flash",
				"glm-4.7-flashx",
				"glm-4.5-air",
				"glm-4.5v",
				// MLX format (from user's report)
				"mlx-community/GLM-4.5-4bit",
				"mlx-community/GLM-4.5-8bit",
				"mlx-community/GLM-4.7-4bit",
				// GGUF format (from user's report)
				"GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf",
				"GLM-4.5-UD-Q4_K_M.gguf",
				"GLM-4.7-UD-Q8_K_XL.gguf",
				// HuggingFace format
				"THUDM/glm-4-9b-chat",
				"THUDM/glm-4v-9b",
				"THUDM/glm-4.7-chat",
				// ChatGLM variants
				"chatglm-6b",
				"chatglm2-6b",
				"chatglm3-6b",
				"ChatGLM-6B",
				// Without hyphen
				"glm4",
				"GLM4",
				"glm47",
				"GLM4.7",
				// Mixed case
				"GLM-4.5",
				"Glm-4.5",
				"Glm-4.7",
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

	describe("isGlm47Plus", () => {
		describe("should detect GLM-4.7+ models", () => {
			const glm47PlusModels = [
				// Standard GLM-4.7 variants (with dot separator)
				"glm-4.7",
				"GLM-4.7",
				"glm-4.7-flash",
				"glm-4.7-flashx",
				"GLM-4.7-Flash",
				// GLM-4.8, 4.9, etc.
				"glm-4.8",
				"glm-4.9",
				"glm-4.10",
				"glm-4.99",
				// GLM-5.0 and above
				"glm-5.0",
				"glm-6.0",
				"glm-9.0",
				// With underscores
				"glm_4.7",
				"glm_4.8",
				// MLX format
				"mlx-community/GLM-4.7-4bit",
				"mlx-community/GLM-4.8-8bit",
				// GGUF format
				"GLM-4.7-UD-Q8_K_XL.gguf",
				"GLM-4.9-UD-Q4_K_M.gguf",
				// HuggingFace format
				"THUDM/glm-4.7-chat",
				"THUDM/glm-5.0-instruct",
			]

			test.each(glm47PlusModels)('should detect "%s" as GLM-4.7+', (modelId) => {
				expect(isGlm47Plus(modelId)).toBe(true)
			})
		})

		describe("should NOT detect GLM-4.6 and lower versions", () => {
			const olderGlmModels = [
				// GLM-4.6 and lower
				"glm-4.6",
				"glm-4.5",
				"glm-4.0",
				"GLM-4.6",
				"glm-4.5-air",
				"glm-4.6v",
				// Without proper version separator (ambiguous format)
				"glm47",
				"glm48",
				"glm4.7",
				"GLM4.7",
				// ChatGLM older versions (different model series)
				"chatglm-6b",
				"chatglm2-6b",
				"chatglm3-6b",
				// MLX format with older versions
				"mlx-community/GLM-4.5-4bit",
				"mlx-community/GLM-4.6-8bit",
				// GGUF format with older versions
				"GLM-4.5-UD-Q8_K_XL.gguf",
				"GLM-4.6-UD-Q4_K_M.gguf",
				// Non-GLM models
				"gpt-4.7",
				"llama-4.7",
				"",
			]

			test.each(olderGlmModels)('should NOT detect "%s" as GLM-4.7+', (modelId) => {
				expect(isGlm47Plus(modelId)).toBe(false)
			})
		})

		it("should return false for undefined modelId", () => {
			expect(isGlm47Plus(undefined)).toBe(false)
		})
	})

	describe("getGlmModelOptions", () => {
		describe("GLM-4.7+ models", () => {
			it("should return options with thinking support for glm-4.7", () => {
				const options = getGlmModelOptions("glm-4.7")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: true,
				})
			})

			it("should return options with thinking support for GLM-4.7-flash", () => {
				const options = getGlmModelOptions("GLM-4.7-flash")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: true,
				})
			})

			it("should return options with thinking support for MLX GLM-4.7 models", () => {
				const options = getGlmModelOptions("mlx-community/GLM-4.7-4bit")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: true,
				})
			})

			it("should return options with thinking support for GGUF GLM-4.7 models", () => {
				const options = getGlmModelOptions("GLM-4.7-UD-Q8_K_XL-00001-of-00008.gguf")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: true,
				})
			})

			it("should return options with thinking support for GLM-4.8+", () => {
				const options = getGlmModelOptions("glm-4.8")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: true,
				})
			})

			it("should return options with thinking support for GLM-5.0+", () => {
				const options = getGlmModelOptions("glm-5.0")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: true,
				})
			})
		})

		describe("GLM-4.6 and lower models", () => {
			it("should return options WITHOUT thinking support for glm-4.5", () => {
				const options = getGlmModelOptions("glm-4.5")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: false,
				})
			})

			it("should return options WITHOUT thinking support for glm-4.6", () => {
				const options = getGlmModelOptions("glm-4.6")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: false,
				})
			})

			it("should return options WITHOUT thinking support for MLX GLM-4.5 models", () => {
				const options = getGlmModelOptions("mlx-community/GLM-4.5-4bit")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: false,
				})
			})

			it("should return options WITHOUT thinking support for GGUF GLM-4.5 models", () => {
				const options = getGlmModelOptions("GLM-4.5-UD-Q8_K_XL-00001-of-00008.gguf")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: false,
				})
			})

			it("should return options WITHOUT thinking support for chatglm (different series)", () => {
				const options = getGlmModelOptions("chatglm-6b")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: false,
				})
			})

			it("should return options WITHOUT thinking support for ambiguous formats", () => {
				const options = getGlmModelOptions("glm47")
				expect(options).toEqual({
					mergeToolResultText: true,
					disableParallelToolCalls: true,
					supportsThinking: false,
				})
			})
		})

		describe("non-GLM models", () => {
			it("should return undefined for gpt-4", () => {
				expect(getGlmModelOptions("gpt-4")).toBeUndefined()
			})

			it("should return undefined for llama-3.1", () => {
				expect(getGlmModelOptions("llama-3.1")).toBeUndefined()
			})

			it("should return undefined for claude-3", () => {
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
})
