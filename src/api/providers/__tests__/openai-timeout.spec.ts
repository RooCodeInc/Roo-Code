// npx vitest run api/providers/__tests__/openai-timeout.spec.ts

import { OpenAiHandler } from "../openai"
import { ApiHandlerOptions } from "../../../shared/api"

const mockCreateOpenAI = vi.hoisted(() => vi.fn())
const mockCreateOpenAICompatible = vi.hoisted(() => vi.fn())
const mockCreateAzure = vi.hoisted(() => vi.fn())

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: mockCreateOpenAI.mockImplementation(() => ({
		chat: vi.fn(() => ({ modelId: "test", provider: "openai.chat" })),
	})),
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: mockCreateOpenAICompatible.mockImplementation(() =>
		vi.fn((modelId: string) => ({ modelId, provider: "openai-compatible" })),
	),
}))

vi.mock("@ai-sdk/azure", () => ({
	createAzure: mockCreateAzure.mockImplementation(() => ({
		chat: vi.fn((modelId: string) => ({ modelId, provider: "azure.chat" })),
	})),
}))

describe("OpenAiHandler provider configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should use createOpenAI for standard OpenAI endpoints", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "gpt-4",
			openAiModelId: "gpt-4",
			openAiApiKey: "test-key",
		}

		new OpenAiHandler(options)

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.openai.com/v1",
				apiKey: "test-key",
			}),
		)
	})

	it("should use createOpenAI for custom OpenAI-compatible providers", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "custom-model",
			openAiModelId: "custom-model",
			openAiBaseUrl: "http://localhost:8080/v1",
			openAiApiKey: "test-key",
		}

		new OpenAiHandler(options)

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "http://localhost:8080/v1",
			}),
		)
	})

	it("should use createAzure for Azure OpenAI", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "gpt-4",
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://myinstance.openai.azure.com",
			openAiApiKey: "test-key",
			openAiUseAzure: true,
		}

		new OpenAiHandler(options)

		expect(mockCreateAzure).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://myinstance.openai.azure.com/openai",
				apiKey: "test-key",
				useDeploymentBasedUrls: true,
			}),
		)
	})

	it("should use createOpenAICompatible for Azure AI Inference", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "deepseek",
			openAiModelId: "deepseek",
			openAiBaseUrl: "https://myinstance.services.ai.azure.com",
			openAiApiKey: "test-key",
		}

		new OpenAiHandler(options)

		expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://myinstance.services.ai.azure.com/models",
				apiKey: "test-key",
				queryParams: expect.objectContaining({
					"api-version": expect.any(String),
				}),
			}),
		)
	})

	it("should include custom headers in provider configuration", () => {
		const options: ApiHandlerOptions = {
			apiModelId: "gpt-4",
			openAiModelId: "gpt-4",
			openAiApiKey: "test-key",
			openAiHeaders: { "X-Custom": "value" },
		}

		new OpenAiHandler(options)

		expect(mockCreateOpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Custom": "value",
				}),
			}),
		)
	})
})
