// npx vitest run api/providers/__tests__/openai-codex.spec.ts

import { OpenAiCodexHandler } from "../openai-codex"

describe("OpenAiCodexHandler.getModel", () => {
	it.each(["gpt-5.1", "gpt-5", "gpt-5.1-codex", "gpt-5-codex", "gpt-5-codex-mini", "gpt-5.3-codex-spark"])(
		"should return specified model when a valid model id is provided: %s",
		(apiModelId) => {
			const handler = new OpenAiCodexHandler({ apiModelId })
			const model = handler.getModel()

			expect(model.id).toBe(apiModelId)
			expect(model.info).toBeDefined()
			// Default reasoning effort for GPT-5 family
			expect(model.info.reasoningEffort).toBe("medium")
		},
	)

	it("should preserve custom model id when not in known models", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "not-a-real-model" })
		const model = handler.getModel()

		expect(model.id).toBe("not-a-real-model") // Custom model ID is preserved
		expect(model.info).toBeDefined() // Falls back to default model info
	})

	it("should use Spark-specific limits and capabilities", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex-spark" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.3-codex-spark")
		expect(model.info.contextWindow).toBe(128000)
		expect(model.info.maxTokens).toBe(8192)
		expect(model.info.supportsImages).toBe(false)
	})
})
