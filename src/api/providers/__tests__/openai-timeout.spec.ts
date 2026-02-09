// npx vitest run api/providers/__tests__/openai-timeout.spec.ts
//
// NOTE: The OpenAiHandler now uses @ai-sdk/openai (createOpenAI) which does not
// expose a `timeout` option directly. Timeouts are managed at the fetch level.
// These tests verify provider creation for different configurations instead.

const { mockStreamText, mockGenerateText, mockCreateOpenAI } = vi.hoisted(() => ({
	mockStreamText: vi.fn(),
	mockGenerateText: vi.fn(),
	mockCreateOpenAI: vi.fn(),
}))

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>()
	return {
		...actual,
		streamText: mockStreamText,
		generateText: mockGenerateText,
	}
})

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI.mockImplementation(() => ({
		chat: vi.fn(() => ({
			modelId: "test-model",
			provider: "openai.chat",
		})),
	})),
}))

import { OpenAiHandler } from "../openai"
import type { ApiHandlerOptions } from "../../../shared/api"

describe("OpenAiHandler provider configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should create provider with standard OpenAI config", async () => {
		const options: ApiHandlerOptions = {
			openAiModelId: "gpt-4",
			openAiApiKey: "test-key",
		}

		const handler = new OpenAiHandler(options)

		// Need to trigger createMessage to invoke createProvider
		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "response" }
			})(),
			usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			providerMetadata: Promise.resolve({}),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "Hello" }])
		for await (const _chunk of stream) {
			// consume
		}

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.openai.com/v1",
				apiKey: "test-key",
			}),
		)
	})

	it("should create provider with custom base URL for OpenAI-compatible providers", async () => {
		const options: ApiHandlerOptions = {
			openAiModelId: "custom-model",
			openAiBaseUrl: "http://localhost:8080/v1",
			openAiApiKey: "test-key",
		}

		const handler = new OpenAiHandler(options)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "response" }
			})(),
			usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			providerMetadata: Promise.resolve({}),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "Hello" }])
		for await (const _chunk of stream) {
			// consume
		}

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:8080/v1",
			}),
		)
	})

	it("should create provider with Azure OpenAI config including api-key header", async () => {
		const options: ApiHandlerOptions = {
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://myinstance.openai.azure.com",
			openAiApiKey: "test-key",
			openAiUseAzure: true,
		}

		const handler = new OpenAiHandler(options)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "response" }
			})(),
			usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			providerMetadata: Promise.resolve({}),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "Hello" }])
		for await (const _chunk of stream) {
			// consume
		}

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					"api-key": "test-key",
				}),
			}),
		)
	})

	it("should create provider with Azure AI Inference config using /models baseURL", async () => {
		const options: ApiHandlerOptions = {
			openAiModelId: "deepseek",
			openAiBaseUrl: "https://myinstance.services.ai.azure.com",
			openAiApiKey: "test-key",
		}

		const handler = new OpenAiHandler(options)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "response" }
			})(),
			usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			providerMetadata: Promise.resolve({}),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "Hello" }])
		for await (const _chunk of stream) {
			// consume
		}

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://myinstance.services.ai.azure.com/models",
			}),
		)
	})

	it("should use default base URL when none provided", async () => {
		const options: ApiHandlerOptions = {
			openAiModelId: "gpt-4",
		}

		const handler = new OpenAiHandler(options)

		mockStreamText.mockReturnValue({
			fullStream: (async function* () {
				yield { type: "text-delta", text: "response" }
			})(),
			usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
			providerMetadata: Promise.resolve({}),
		})

		const stream = handler.createMessage("system", [{ role: "user", content: "Hello" }])
		for await (const _chunk of stream) {
			// consume
		}

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.openai.com/v1",
			}),
		)
	})
})
