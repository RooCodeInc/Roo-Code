import { isGlmModel, getGlmModelOptions, GlmModelOptions } from "../model-detection"

describe("isGlmModel", () => {
	describe("GLM model detection", () => {
		it("should detect official GLM model names with dash", () => {
			expect(isGlmModel("glm-4")).toBe(true)
			expect(isGlmModel("glm-4.5")).toBe(true)
			expect(isGlmModel("glm-4.7")).toBe(true)
			expect(isGlmModel("glm-4-plus")).toBe(true)
		})

		it("should detect GLM models with uppercase", () => {
			expect(isGlmModel("GLM-4")).toBe(true)
			expect(isGlmModel("GLM-4.5")).toBe(true)
			expect(isGlmModel("GLM-4.7")).toBe(true)
		})

		it("should detect compact GLM model names without dash", () => {
			expect(isGlmModel("glm4")).toBe(true)
			expect(isGlmModel("GLM4")).toBe(true)
			expect(isGlmModel("glm4-9b")).toBe(true)
		})

		it("should detect LM Studio GGUF model names", () => {
			expect(isGlmModel("GLM4-9B-Chat-GGUF")).toBe(true)
			expect(isGlmModel("glm4-9b-chat-gguf")).toBe(true)
		})

		it("should detect ChatGLM models", () => {
			expect(isGlmModel("chatglm")).toBe(true)
			expect(isGlmModel("ChatGLM")).toBe(true)
			expect(isGlmModel("chatglm-6b")).toBe(true)
			expect(isGlmModel("chatglm3-6b")).toBe(true)
		})
	})

	describe("non-GLM model detection", () => {
		it("should not detect OpenAI models as GLM", () => {
			expect(isGlmModel("gpt-4")).toBe(false)
			expect(isGlmModel("gpt-4-turbo")).toBe(false)
			expect(isGlmModel("gpt-3.5-turbo")).toBe(false)
			expect(isGlmModel("o1-preview")).toBe(false)
		})

		it("should not detect Anthropic models as GLM", () => {
			expect(isGlmModel("claude-3")).toBe(false)
			expect(isGlmModel("claude-3-sonnet")).toBe(false)
			expect(isGlmModel("claude-3-opus")).toBe(false)
		})

		it("should not detect DeepSeek models as GLM", () => {
			expect(isGlmModel("deepseek-coder")).toBe(false)
			expect(isGlmModel("deepseek-reasoner")).toBe(false)
		})

		it("should not detect Gemini models as GLM", () => {
			expect(isGlmModel("gemini-pro")).toBe(false)
			expect(isGlmModel("gemini-2-flash")).toBe(false)
		})

		it("should not detect Qwen models as GLM", () => {
			expect(isGlmModel("qwen-7b")).toBe(false)
			expect(isGlmModel("qwen2-7b")).toBe(false)
		})

		it("should not detect Llama models as GLM", () => {
			expect(isGlmModel("llama-2-7b")).toBe(false)
			expect(isGlmModel("llama-3-8b")).toBe(false)
			expect(isGlmModel("codellama")).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should handle empty string", () => {
			expect(isGlmModel("")).toBe(false)
		})

		it("should handle undefined-like values", () => {
			expect(isGlmModel(null as unknown as string)).toBe(false)
			expect(isGlmModel(undefined as unknown as string)).toBe(false)
		})

		it("should not match 'glm' in the middle of unrelated model names", () => {
			// This tests that we're not accidentally matching "glm" as a substring
			// in unrelated contexts
			expect(isGlmModel("myglmodel")).toBe(false)
			expect(isGlmModel("some-glm-inspired-model")).toBe(false)
		})
	})
})

describe("getGlmModelOptions", () => {
	it("should return GLM-optimized options for GLM models", () => {
		const options = getGlmModelOptions("glm-4.5")

		expect(options.mergeToolResultText).toBe(true)
		expect(options.disableParallelToolCalls).toBe(true)
	})

	it("should return default options for non-GLM models", () => {
		const options = getGlmModelOptions("gpt-4")

		expect(options.mergeToolResultText).toBe(false)
		expect(options.disableParallelToolCalls).toBe(false)
	})

	it("should return the correct type", () => {
		const options: GlmModelOptions = getGlmModelOptions("glm-4")

		expect(options).toHaveProperty("mergeToolResultText")
		expect(options).toHaveProperty("disableParallelToolCalls")
	})
})
