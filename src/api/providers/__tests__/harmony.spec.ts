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
		handler = new HarmonyHandler({
			harmonyApiKey: "test-harmony-api-key",
			harmonyBaseUrl: "https://test-harmony.example.com/v1",
		})
	})

	it("should throw error when harmonyBaseUrl is not provided", () => {
		expect(() => {
			new HarmonyHandler({ harmonyApiKey: "test-harmony-api-key" })
		}).toThrow("Harmony API base URL is required")
	})

	it("should use custom Harmony base URL when provided", () => {
		const customBaseUrl = "https://custom-harmony-endpoint.com/v1"
		new HarmonyHandler({ harmonyApiKey: "test-harmony-api-key", harmonyBaseUrl: customBaseUrl })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: customBaseUrl }))
	})

	it("should use the provided API key", () => {
		const harmonyApiKey = "test-harmony-api-key-123"
		new HarmonyHandler({
			harmonyApiKey,
			harmonyBaseUrl: "https://test-harmony.example.com/v1",
		})
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: harmonyApiKey }))
	})

	it("should handle empty API key gracefully with placeholder", () => {
		new HarmonyHandler({
			harmonyApiKey: "",
			harmonyBaseUrl: "https://test-harmony.example.com/v1",
		})
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
			harmonyBaseUrl: "https://test-harmony.example.com/v1",
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
		const handler = new HarmonyHandler({
			harmonyApiKey: "test-key",
			harmonyBaseUrl: "https://test-harmony.example.com/v1",
		})
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

	describe("convertToolsForOpenAI", () => {
		it("should remove `strict` parameter from function tools to prevent vLLM warnings", () => {
			const tools = [
				{
					type: "function",
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
						strict: true, // This will be added by parent class
					},
				},
			]

			const converted = handler.convertToolsForOpenAI(tools)

			expect(converted).toBeDefined()
			expect(converted).toHaveLength(1)
			expect(converted![0].type).toBe("function")
			expect(converted![0].function.name).toBe("test_tool")
			// The strict parameter should be removed
			expect(converted![0].function.strict).toBeUndefined()
		})

		it("should preserve all other tool properties when removing strict", () => {
			const tools = [
				{
					type: "function",
					function: {
						name: "example_function",
						description: "An example function",
						parameters: {
							type: "object",
							properties: {
								param1: { type: "string", description: "First parameter" },
								param2: { type: "number" },
							},
							required: ["param1"],
							additionalProperties: false,
						},
						strict: false,
					},
				},
			]

			const converted = handler.convertToolsForOpenAI(tools)

			expect(converted).toBeDefined()
			expect(converted![0].function.name).toBe("example_function")
			expect(converted![0].function.description).toBe("An example function")
			expect(converted![0].function.parameters).toEqual({
				type: "object",
				properties: {
					param1: { type: "string", description: "First parameter" },
					param2: { type: "number" },
				},
				// Parent class adds all properties to required for OpenAI strict mode
				required: ["param1", "param2"],
				additionalProperties: false,
			})
			expect(converted![0].function.strict).toBeUndefined()
		})

		it("should handle MCP tools (which have strict: false from parent)", () => {
			const tools = [
				{
					type: "function",
					function: {
						name: "mcp--my_mcp_tool",
						description: "An MCP tool",
						parameters: { type: "object", properties: {} },
						strict: false, // MCP tools get strict: false from parent
					},
				},
			]

			const converted = handler.convertToolsForOpenAI(tools)

			expect(converted).toBeDefined()
			expect(converted![0].function.name).toBe("mcp--my_mcp_tool")
			// MCP tools should also have strict removed
			expect(converted![0].function.strict).toBeUndefined()
		})

		it("should handle non-function tools without modification", () => {
			const tools = [
				{
					type: "some_other_type",
					data: "test",
				},
			]

			const converted = handler.convertToolsForOpenAI(tools)

			expect(converted).toBeDefined()
			expect(converted![0]).toEqual({
				type: "some_other_type",
				data: "test",
			})
		})

		it("should return undefined for undefined input", () => {
			const converted = handler.convertToolsForOpenAI(undefined)
			expect(converted).toBeUndefined()
		})
	})
})
