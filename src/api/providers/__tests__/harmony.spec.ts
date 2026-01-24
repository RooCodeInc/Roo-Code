// npx vitest run src/api/providers/__tests__/harmony.spec.ts

import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { type HarmonyModelId, harmonyDefaultModelId, harmonyModels } from "@roo-code/types"

import { HarmonyHandler } from "../harmony"

vitest.mock("openai", () => {
	const createMock = vitest.fn()
	return {
		default: vitest.fn(() => ({ chat: { completions: { create: createMock } } })),
	}
})

describe("HarmonyHandler", () => {
	let handler: HarmonyHandler
	let mockCreate: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockCreate = (OpenAI as unknown as any)().chat.completions.create
		handler = new HarmonyHandler({ harmonyApiKey: "test-harmony-api-key" })
	})

	it("should use the correct Harmony base URL by default", () => {
		new HarmonyHandler({ harmonyApiKey: "test-harmony-api-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://ai.mezzanineapps.com/v1" }))
	})

	it("should use custom Harmony base URL when provided", () => {
		const customBaseUrl = "https://custom-harmony-endpoint.com/v1"
		new HarmonyHandler({ harmonyApiKey: "test-harmony-api-key", harmonyBaseUrl: customBaseUrl })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: customBaseUrl }))
	})

	it("should use the provided API key", () => {
		const harmonyApiKey = "test-harmony-api-key-123"
		new HarmonyHandler({ harmonyApiKey })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: harmonyApiKey }))
	})

	it("should handle empty API key gracefully with placeholder", () => {
		new HarmonyHandler({ harmonyApiKey: "" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-placeholder" }))
	})

	it("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(harmonyDefaultModelId)
		expect(model.info).toEqual(harmonyModels[harmonyDefaultModelId])
	})

	it("should return specified model when valid model is provided", () => {
		const testModelId: HarmonyModelId = "gpt-oss-120b"
		const handlerWithModel = new HarmonyHandler({
			apiModelId: testModelId,
			harmonyApiKey: "test-harmony-api-key",
		})
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(harmonyModels[testModelId])
	})

	it("should support both supported Harmony models", () => {
		const supportedModels: HarmonyModelId[] = ["gpt-oss-20b", "gpt-oss-120b"]
		supportedModels.forEach((modelId) => {
			expect(harmonyModels[modelId]).toBeDefined()
			expect(harmonyModels[modelId].contextWindow).toBe(128000)
			expect(harmonyModels[modelId].supportsReasoningEffort).toEqual(["low", "medium", "high"])
		})
	})

	it("should have reasonable default temperature", () => {
		const handler = new HarmonyHandler({ harmonyApiKey: "test-key" })
		// BaseOpenAiCompatibleProvider sets defaultTemperature to 0.7
		expect(handler["defaultTemperature"]).toBe(0.7)
	})

	it("should have correct model specifications", () => {
		const gptOss20b = harmonyModels["gpt-oss-20b"]
		const gptOss120b = harmonyModels["gpt-oss-120b"]

		// Check context windows
		expect(gptOss20b.contextWindow).toBe(128000)
		expect(gptOss120b.contextWindow).toBe(128000)

		// Check max tokens
		expect(gptOss20b.maxTokens).toBe(8192)
		expect(gptOss120b.maxTokens).toBe(8192)

		// Check image support
		expect(gptOss20b.supportsImages).toBe(false)
		expect(gptOss120b.supportsImages).toBe(false)

		// Check prompt cache support
		expect(gptOss20b.supportsPromptCache).toBe(false)
		expect(gptOss120b.supportsPromptCache).toBe(false)

		// Check reasoning effort support
		expect(gptOss20b.supportsReasoningEffort).toEqual(["low", "medium", "high"])
		expect(gptOss120b.supportsReasoningEffort).toEqual(["low", "medium", "high"])
	})

	it("should initialize with proper provider name", () => {
		expect(handler["providerName"]).toBe("Harmony")
	})
})
