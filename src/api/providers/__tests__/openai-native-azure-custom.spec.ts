import { describe, it, expect, vitest, afterEach } from "vitest"

import { OpenAiNativeHandler } from "../openai-native"
import type { ApiHandlerOptions } from "../../../shared/api"

// Mock OpenAI client
const mockResponsesCreate = vitest.fn()

vitest.mock("openai", () => {
	return {
		__esModule: true,
		default: vitest.fn().mockImplementation(() => ({
			responses: {
				create: mockResponsesCreate,
			},
		})),
	}
})

describe("OpenAiNativeHandler - Azure Custom URL", () => {
	const azureOptions: ApiHandlerOptions = {
		apiModelId: "gpt-4.1",
		openAiNativeApiKey: "test-azure-api-key",
	}

	afterEach(() => {
		if ((global as any).fetch) {
			delete (global as any).fetch
		}
		mockResponsesCreate.mockClear()
	})

	it("should detect Azure OpenAI from custom URL with /openai/ path", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		// Mock SDK to fail to force fetch fallback
		mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

		// Custom URL that doesn't end in .azure.com but has /openai/ path
		const customUrl = "https://my-custom-proxy.com/openai/v1"

		const handler = new OpenAiNativeHandler({
			...azureOptions,
			openAiNativeBaseUrl: customUrl,
		})

		const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])

		for await (const _ of stream) {
			// drain
		}

		// Verify it was treated as Azure (api-key header used)
		const callHeaders = mockFetch.mock.calls[0][1].headers
		expect(callHeaders["api-key"]).toBe("test-azure-api-key")
		expect(callHeaders["Authorization"]).toBeUndefined()

		// Verify URL construction
		// It should append /responses to the base URL
		expect(mockFetch).toHaveBeenCalledWith("https://my-custom-proxy.com/openai/v1/responses", expect.anything())
	})

	it("should preserve query params when custom Azure URL includes api-version", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

		const customUrl = "https://my-custom-proxy.com/openai/v1?api-version=2024-05-01-preview"

		const handler = new OpenAiNativeHandler({
			...azureOptions,
			openAiNativeBaseUrl: customUrl,
		})

		const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])

		for await (const _ of stream) {
			// drain
		}

		const callUrl = mockFetch.mock.calls[0][0]
		expect(callUrl).toBe("https://my-custom-proxy.com/openai/v1/responses?api-version=2024-05-01-preview")

		const callHeaders = mockFetch.mock.calls[0][1].headers
		expect(callHeaders["api-key"]).toBe("test-azure-api-key")
	})

	it("should NOT detect Azure OpenAI from custom URL without /openai/ path", async () => {
		const mockFetch = vitest.fn().mockResolvedValue({
			ok: true,
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
					controller.close()
				},
			}),
		})
		global.fetch = mockFetch as any

		// Mock SDK to fail to force fetch fallback
		mockResponsesCreate.mockRejectedValue(new Error("SDK not available"))

		// Custom URL that doesn't end in .azure.com and NO /openai/ path
		const customUrl = "https://my-custom-proxy.com/v1"

		const handler = new OpenAiNativeHandler({
			...azureOptions,
			openAiNativeBaseUrl: customUrl,
		})

		const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])

		for await (const _ of stream) {
			// drain
		}

		// Verify it was treated as Standard OpenAI (Authorization header used)
		const callHeaders = mockFetch.mock.calls[0][1].headers
		expect(callHeaders["Authorization"]).toBe("Bearer test-azure-api-key")
		expect(callHeaders["api-key"]).toBeUndefined()

		// Verify URL construction
		expect(mockFetch).toHaveBeenCalledWith("https://my-custom-proxy.com/v1/responses", expect.anything())
	})
})
