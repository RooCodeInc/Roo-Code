import { describe, it, expect, vi, beforeEach } from "vitest"
import { AnthropicHandler } from "../anthropic"
import { Anthropic } from "@anthropic-ai/sdk"

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
	const mockAnthropicConstructor = vi.fn().mockImplementation(() => ({
		messages: {
			create: vi.fn(),
		},
	}))

	return {
		Anthropic: mockAnthropicConstructor,
	}
})

describe("AnthropicHandler Error Handling", () => {
	let handler: AnthropicHandler
	let mockClient: any

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new AnthropicHandler({
			apiKey: "test-api-key",
			apiModelId: "claude-opus-4-1-20250805",
		})
		mockClient = (handler as any).client
	})

	describe("createMessage error handling", () => {
		it("should handle false positive 'Claude AI usage limit reached' error with future timestamp", async () => {
			// Create a timestamp that's far in the future (year 2030+)
			const currentTime = Math.floor(Date.now() / 1000)
			const futureTimestamp = currentTime + 10 * 365 * 24 * 60 * 60 // 10 years from now
			const errorMessage = `Claude AI usage limit reached|${futureTimestamp}`

			mockClient.messages.create.mockRejectedValue(new Error(errorMessage))

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toThrow(/API error for model.*The API returned an unexpected error format/)
		})

		it("should handle legitimate rate limit errors with status 429", async () => {
			const error = new Error("Rate limit exceeded")
			;(error as any).status = 429

			mockClient.messages.create.mockRejectedValue(error)

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toThrow(/Rate limit exceeded for model.*Please wait before making more requests/)
		})

		it("should handle rate_limit_error in message", async () => {
			const error = new Error("rate_limit_error: Too many requests")

			mockClient.messages.create.mockRejectedValue(error)

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toThrow(/Rate limit exceeded for model.*Please wait before making more requests/)
		})

		it("should pass through other errors unchanged", async () => {
			const error = new Error("Some other API error")

			mockClient.messages.create.mockRejectedValue(error)

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toThrow("Some other API error")
		})

		it("should handle 'Claude AI usage limit reached' with valid timestamp correctly", async () => {
			// Use a timestamp that's not in the future
			const currentTimestamp = Math.floor(Date.now() / 1000)
			const errorMessage = `Claude AI usage limit reached|${currentTimestamp}`

			mockClient.messages.create.mockRejectedValue(new Error(errorMessage))

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			// Should pass through the original error since timestamp is valid
			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toThrow(errorMessage)
		})
	})

	describe("completePrompt error handling", () => {
		it("should handle false positive 'Claude AI usage limit reached' error with future timestamp", async () => {
			// Create a timestamp that's far in the future (year 2030+)
			const currentTime = Math.floor(Date.now() / 1000)
			const futureTimestamp = currentTime + 10 * 365 * 24 * 60 * 60 // 10 years from now
			const errorMessage = `Claude AI usage limit reached|${futureTimestamp}`

			mockClient.messages.create.mockRejectedValue(new Error(errorMessage))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				/API error for model.*The API returned an unexpected error format/,
			)
		})

		it("should handle legitimate rate limit errors with status 429", async () => {
			const error = new Error("Rate limit exceeded")
			;(error as any).status = 429

			mockClient.messages.create.mockRejectedValue(error)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				/Rate limit exceeded for model.*Please wait before making more requests/,
			)
		})

		it("should handle rate_limit_error in message", async () => {
			const error = new Error("rate_limit_error: Too many requests")

			mockClient.messages.create.mockRejectedValue(error)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				/Rate limit exceeded for model.*Please wait before making more requests/,
			)
		})

		it("should pass through other errors unchanged", async () => {
			const error = new Error("Some other API error")

			mockClient.messages.create.mockRejectedValue(error)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Some other API error")
		})

		it("should handle 'Claude AI usage limit reached' with valid timestamp correctly", async () => {
			// Use a timestamp that's not in the future
			const currentTimestamp = Math.floor(Date.now() / 1000)
			const errorMessage = `Claude AI usage limit reached|${currentTimestamp}`

			mockClient.messages.create.mockRejectedValue(new Error(errorMessage))

			// Should pass through the original error since timestamp is valid
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(errorMessage)
		})
	})

	describe("edge cases", () => {
		it("should handle error without message property", async () => {
			const error = { status: 500 }

			mockClient.messages.create.mockRejectedValue(error)

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toEqual(error)
		})

		it("should handle error with non-string message", async () => {
			const error = new Error()
			;(error as any).message = { code: "ERROR_CODE" }

			mockClient.messages.create.mockRejectedValue(error)

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toEqual(error)
		})

		it("should handle 'Claude AI usage limit reached' without timestamp", async () => {
			const errorMessage = "Claude AI usage limit reached"

			mockClient.messages.create.mockRejectedValue(new Error(errorMessage))

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			// Should pass through the original error since no timestamp to validate
			await expect(async () => {
				const results = []
				for await (const chunk of generator) {
					results.push(chunk)
				}
			}).rejects.toThrow(errorMessage)
		})
	})
})
