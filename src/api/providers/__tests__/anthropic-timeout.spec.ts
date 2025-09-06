// npx vitest run api/providers/__tests__/anthropic-timeout.spec.ts

import { describe, it, expect, beforeEach, vitest } from "vitest"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock the timeout config utility
vitest.mock("../utils/timeout-config", () => ({
	getApiRequestTimeout: vitest.fn(),
}))

import { getApiRequestTimeout } from "../utils/timeout-config"

// Mock the Anthropic SDK
vitest.mock("@anthropic-ai/sdk", () => {
	const mockAnthropicConstructor = vitest.fn().mockImplementation(() => ({
		messages: {
			create: vitest.fn(),
			countTokens: vitest.fn(),
		},
	}))
	return {
		Anthropic: mockAnthropicConstructor,
	}
})

// Import after mocks
import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicHandler } from "../anthropic"

const mockAnthropicConstructor = Anthropic as any

describe("AnthropicHandler timeout configuration", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
	})

	it("should use default timeout of 600 seconds when no configuration is set", () => {
		;(getApiRequestTimeout as any).mockReturnValue(600000)

		const options: ApiHandlerOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		new AnthropicHandler(options)

		expect(getApiRequestTimeout).toHaveBeenCalled()
		expect(mockAnthropicConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "test-api-key",
				timeout: 600000, // 600 seconds in milliseconds
			}),
		)
	})

	it("should use custom timeout when configuration is set", () => {
		;(getApiRequestTimeout as any).mockReturnValue(1800000) // 30 minutes

		const options: ApiHandlerOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		new AnthropicHandler(options)

		expect(mockAnthropicConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "test-api-key",
				timeout: 1800000, // 1800 seconds in milliseconds
			}),
		)
	})

	it("should handle zero timeout (no timeout)", () => {
		;(getApiRequestTimeout as any).mockReturnValue(0)

		const options: ApiHandlerOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		new AnthropicHandler(options)

		expect(mockAnthropicConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "test-api-key",
				timeout: 0, // No timeout
			}),
		)
	})

	it("should use custom base URL when provided", () => {
		;(getApiRequestTimeout as any).mockReturnValue(600000)

		const options: ApiHandlerOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
			anthropicBaseUrl: "https://custom.anthropic.com",
		}

		new AnthropicHandler(options)

		expect(mockAnthropicConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://custom.anthropic.com",
				apiKey: "test-api-key",
				timeout: 600000,
			}),
		)
	})

	it("should use authToken when anthropicUseAuthToken is set with custom base URL", () => {
		;(getApiRequestTimeout as any).mockReturnValue(900000) // 15 minutes

		const options: ApiHandlerOptions = {
			apiKey: "test-auth-token",
			apiModelId: "claude-3-5-sonnet-20241022",
			anthropicBaseUrl: "https://custom.anthropic.com",
			anthropicUseAuthToken: true,
		}

		new AnthropicHandler(options)

		expect(mockAnthropicConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://custom.anthropic.com",
				authToken: "test-auth-token",
				timeout: 900000,
			}),
		)
	})

	it("should use apiKey when anthropicUseAuthToken is set but no custom base URL", () => {
		;(getApiRequestTimeout as any).mockReturnValue(600000)

		const options: ApiHandlerOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
			anthropicUseAuthToken: true,
		}

		new AnthropicHandler(options)

		expect(mockAnthropicConstructor).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: "test-api-key",
				timeout: 600000,
			}),
		)
	})
})
