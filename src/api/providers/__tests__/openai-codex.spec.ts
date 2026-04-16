// npx vitest run api/providers/__tests__/openai-codex.spec.ts

import { OpenAiCodexHandler } from "../openai-codex"

describe("OpenAiCodexHandler.getModel", () => {
	it.each([
		"gpt-5.1",
		"gpt-5",
		"gpt-5.1-codex",
		"gpt-5-codex",
		"gpt-5-codex-mini",
		"gpt-5.3-codex-spark",
		"gpt-5.4-codex",
		"gpt-5.4-codex-spark",
		"gpt-5.4-mini-codex-spark",
	])("should return specified model when a valid model id is provided: %s", (apiModelId) => {
		const handler = new OpenAiCodexHandler({ apiModelId })
		const model = handler.getModel()

		expect(model.id).toBe(apiModelId)
		expect(model.info).toBeDefined()
		// Default reasoning effort for GPT-5 family
		expect(model.info.reasoningEffort).toBe("medium")
	})

	it("should fall back to default model when an invalid model id is provided", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "not-a-real-model" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.3-codex")
		expect(model.info).toBeDefined()
	})

	it("should use Spark-specific limits and capabilities", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.3-codex-spark" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.3-codex-spark")
		expect(model.info.contextWindow).toBe(128000)
		expect(model.info.maxTokens).toBe(8192)
		expect(model.info.supportsImages).toBe(false)
	})

	it("should use GPT-5.4 Mini capabilities when selected", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.4-mini" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.4-mini")
		expect(model.info).toBeDefined()
	})

	it("should use GPT-5.4 Codex capabilities when selected", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.4-codex" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.4-codex")
		expect(model.info.contextWindow).toBe(1_050_000)
		expect(model.info.maxTokens).toBe(128000)
		expect(model.info.supportsImages).toBe(true)
		expect(model.info.reasoningEffort).toBe("medium")
	})

	it("should use GPT-5.4 Codex Spark-specific limits and capabilities", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.4-codex-spark" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.4-codex-spark")
		expect(model.info.contextWindow).toBe(128000)
		expect(model.info.maxTokens).toBe(8192)
		expect(model.info.supportsImages).toBe(false)
	})

	it("should use GPT-5.4 Mini Codex Spark-specific limits and capabilities", () => {
		const handler = new OpenAiCodexHandler({ apiModelId: "gpt-5.4-mini-codex-spark" })
		const model = handler.getModel()

		expect(model.id).toBe("gpt-5.4-mini-codex-spark")
		expect(model.info.contextWindow).toBe(128000)
		expect(model.info.maxTokens).toBe(8192)
		expect(model.info.supportsImages).toBe(false)
	})
})
