import { describe, it, expect, vi, beforeEach } from "vitest"
import { APIError } from "openai"
import { handleOpenAIError } from "../openai-error-handler"

// Mock i18n
vi.mock("../../../../i18n/setup", () => ({
	default: {
		t: (key: string) => key,
	},
}))

describe("handleOpenAIError", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	describe("APIError handling", () => {
		it("should extract detailed error message from APIError with status 400", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 400,
				message: "Bad Request",
				error: {
					message: "Invalid request: missing required parameter 'model'",
					type: "invalid_request_error",
				},
			})

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe(
				"openai completion error: 400 \"invalid_request_error\" Invalid request: missing required parameter 'model'",
			)
		})

		it("should handle nested error structure", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 400,
				error: {
					error: {
						message: "The model `gpt-4-turbo` does not exist",
						type: "invalid_request_error",
						code: "model_not_found",
					},
				},
			})

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe(
				'openai completion error: 400 "invalid_request_error" The model `gpt-4-turbo` does not exist',
			)
		})

		it("should include status code when available", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 401,
				message: "Unauthorized",
				error: {
					message: "Invalid API key provided",
					type: "authentication_error",
				},
			})

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe('openai completion error: 401 "authentication_error" Invalid API key provided')
		})

		it("should handle 429 rate limit errors", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 429,
				message: "Too Many Requests",
				error: {
					message: "Rate limit exceeded. Please try again in 20 seconds.",
					type: "rate_limit_error",
				},
			})

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe(
				'openai completion error: 429 "rate_limit_error" Rate limit exceeded. Please try again in 20 seconds.',
			)
		})

		it("should handle errors with code property", () => {
			const error = Object.create(APIError.prototype)
			Object.assign(error, {
				status: 400,
				code: "context_length_exceeded",
				message: "Context length exceeded",
			})

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe(
				'openai completion error: 400 "context_length_exceeded" Context length exceeded',
			)
		})
	})

	describe("Regular Error handling", () => {
		it("should handle regular Error instances", () => {
			const error = new Error("Connection timeout")
			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("openai completion error: Connection timeout")
		})

		it("should handle axios-like errors with response data", () => {
			const error = new Error("Request failed")
			;(error as any).response = {
				data: {
					error: {
						message: "Invalid JSON in request body",
					},
				},
			}

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("openai completion error: Invalid JSON in request body")
		})

		it("should handle errors with response.data.message", () => {
			const error = new Error("Request failed")
			;(error as any).response = {
				data: {
					message: "Request body too large",
				},
			}

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("openai completion error: Request body too large")
		})
	})

	describe("Plain object error handling", () => {
		it("should handle plain objects with error.message", () => {
			const error = {
				error: {
					message: "Invalid parameters",
				},
			}

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("openai completion error: Invalid parameters")
		})

		it("should handle plain objects with message property", () => {
			const error = {
				message: "Service unavailable",
			}

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("openai completion error: Service unavailable")
		})

		it("should handle plain objects with detail property", () => {
			const error = {
				detail: "Authentication failed: token expired",
			}

			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("openai completion error: Authentication failed: token expired")
		})
	})

	describe("Special error cases", () => {
		it("should handle ByteString conversion errors", () => {
			const error = new Error(
				"Cannot convert argument to a ByteString because the character at index 5 has value 65533",
			)
			const result = handleOpenAIError(error, "openai")
			expect(result.message).toBe("common:errors.api.invalidKeyInvalidChars")
		})

		it("should handle null errors", () => {
			const result = handleOpenAIError(null, "openai")
			expect(result.message).toBe("openai completion error: null")
		})

		it("should handle undefined errors", () => {
			const result = handleOpenAIError(undefined, "openai")
			expect(result.message).toBe("openai completion error: undefined")
		})

		it("should handle string errors", () => {
			const result = handleOpenAIError("Network error", "openai")
			expect(result.message).toBe("openai completion error: Network error")
		})

		it("should handle number errors", () => {
			const result = handleOpenAIError(500, "openai")
			expect(result.message).toBe("openai completion error: 500")
		})
	})

	describe("Provider name handling", () => {
		it("should use the correct provider name in error messages", () => {
			const error = new Error("API error")

			const result1 = handleOpenAIError(error, "anthropic")
			expect(result1.message).toBe("anthropic completion error: API error")

			const result2 = handleOpenAIError(error, "openai-compatible")
			expect(result2.message).toBe("openai-compatible completion error: API error")
		})
	})

	describe("Logging", () => {
		it("should log error details for debugging", () => {
			const consoleSpy = vi.spyOn(console, "error")
			const error = new Error("Test error")

			handleOpenAIError(error, "openai")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[openai] API error:",
				expect.objectContaining({
					message: "Test error",
					error: expect.objectContaining({
						name: "Error",
						stack: expect.any(String),
					}),
				}),
			)
		})

		it("should log non-Error objects", () => {
			const consoleSpy = vi.spyOn(console, "error")
			const error = { custom: "error object" }

			handleOpenAIError(error, "openai")

			expect(consoleSpy).toHaveBeenCalledWith(
				"[openai] API error:",
				expect.objectContaining({
					message: "[object Object]",
					error: { custom: "error object" },
				}),
			)
		})
	})
})
