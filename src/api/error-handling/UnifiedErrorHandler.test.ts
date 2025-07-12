import { describe, test, expect } from "vitest"
import { UnifiedErrorHandler, ErrorContext } from "./UnifiedErrorHandler"

describe("UnifiedErrorHandler", () => {
	const createContext = (overrides: Partial<ErrorContext> = {}): ErrorContext => ({
		isStreaming: false,
		provider: "anthropic",
		modelId: "claude-3-sonnet",
		retryAttempt: 0,
		requestId: "test-request",
		...overrides,
	})

	describe("error classification", () => {
		test("classifies HTTP 429 as THROTTLING", () => {
			const error = { status: 429, message: "Rate limit exceeded" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("THROTTLING")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies ThrottlingException as THROTTLING", () => {
			const error = { name: "ThrottlingException", message: "Request was throttled" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("THROTTLING")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies AccessDeniedException as ACCESS_DENIED", () => {
			const error = { name: "AccessDeniedException", message: "Access denied" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("ACCESS_DENIED")
			expect(result.shouldRetry).toBe(false)
			expect(result.shouldThrow).toBe(true)
		})

		test("classifies ResourceNotFoundException as NOT_FOUND", () => {
			const error = { name: "ResourceNotFoundException", message: "Resource not found" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("NOT_FOUND")
			expect(result.shouldRetry).toBe(false)
			expect(result.shouldThrow).toBe(true)
		})

		test("classifies ServiceUnavailableException as SERVICE_UNAVAILABLE", () => {
			const error = { name: "ServiceUnavailableException", message: "Service unavailable" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("SERVICE_UNAVAILABLE")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies ValidationException as INVALID_REQUEST", () => {
			const error = { name: "ValidationException", message: "Invalid request" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("INVALID_REQUEST")
			expect(result.shouldRetry).toBe(false)
			expect(result.shouldThrow).toBe(true)
		})

		test("classifies throttling patterns in message", () => {
			const error = new Error("too many requests, please wait")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("THROTTLING")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies rate limit patterns in message", () => {
			const error = new Error("rate limit exceeded, please wait")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("RATE_LIMITED")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies quota patterns in message", () => {
			const error = new Error("quota exceeded for this month")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("QUOTA_EXCEEDED")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies network errors", () => {
			const error = new Error("network connection failed")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("NETWORK_ERROR")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies timeout errors", () => {
			const error = new Error("request timed out")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("TIMEOUT")
			expect(result.shouldRetry).toBe(true)
		})

		test("classifies generic errors", () => {
			const error = new Error("something went wrong")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("GENERIC")
		})

		test("classifies unknown non-Error objects", () => {
			const error = "string error"
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.errorType).toBe("UNKNOWN")
		})
	})

	describe("retry logic", () => {
		test("retries throttling errors up to max attempts", () => {
			const error = { status: 429, message: "Rate limit exceeded" }

			// Should retry for first few attempts
			for (let attempt = 0; attempt < 5; attempt++) {
				const context = createContext({ retryAttempt: attempt })
				const result = UnifiedErrorHandler.handle(error, context)
				expect(result.shouldRetry).toBe(true)
			}

			// Should not retry after max attempts
			const contextMaxAttempts = createContext({ retryAttempt: 5 })
			const resultMaxAttempts = UnifiedErrorHandler.handle(error, contextMaxAttempts)
			expect(resultMaxAttempts.shouldRetry).toBe(false)
		})

		test("does not retry non-retryable errors", () => {
			const error = { name: "AccessDeniedException", message: "Access denied" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.shouldRetry).toBe(false)
		})

		test("retries service unavailable errors", () => {
			const error = new Error("service temporarily unavailable")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.shouldRetry).toBe(true)
		})
	})

	describe("streaming context handling", () => {
		test("throws immediately for throttling in streaming context", () => {
			const error = { status: 429, message: "Rate limit exceeded" }
			const context = createContext({ isStreaming: true })

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.shouldThrow).toBe(true)
			expect(result.shouldRetry).toBe(true) // Still retryable, but should throw for proper handling
		})

		test("provides stream chunks for non-throwing streaming errors", () => {
			const error = new Error("generic error")
			const context = createContext({ isStreaming: true })

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.streamChunks).toBeDefined()
			expect(result.streamChunks).toHaveLength(2)
			expect(result.streamChunks![0].type).toBe("text")
			expect(result.streamChunks![1].type).toBe("usage")
		})

		test("does not provide stream chunks for non-streaming context", () => {
			const error = new Error("generic error")
			const context = createContext({ isStreaming: false })

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.streamChunks).toBeUndefined()
		})
	})

	describe("retry delay calculation", () => {
		test("calculates exponential backoff", () => {
			const error = new Error("generic error message")

			const context0 = createContext({ retryAttempt: 0 })
			const result0 = UnifiedErrorHandler.handle(error, context0)
			expect(result0.retryDelay).toBe(5) // base delay

			const context1 = createContext({ retryAttempt: 1 })
			const result1 = UnifiedErrorHandler.handle(error, context1)
			expect(result1.retryDelay).toBe(10) // 5 * 2^1

			const context2 = createContext({ retryAttempt: 2 })
			const result2 = UnifiedErrorHandler.handle(error, context2)
			expect(result2.retryDelay).toBe(20) // 5 * 2^2
		})

		test("respects maximum delay", () => {
			const error = new Error("service unavailable")
			const context = createContext({ retryAttempt: 10 }) // Very high retry attempt

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.retryDelay).toBeLessThanOrEqual(600) // Max 10 minutes
		})

		test("adjusts delay based on error type", () => {
			const baseRetryAttempt = 1

			// Service unavailable gets longer delay
			const serviceError = { name: "ServiceUnavailableException", message: "Service unavailable" }
			const serviceContext = createContext({ retryAttempt: baseRetryAttempt })
			const serviceResult = UnifiedErrorHandler.handle(serviceError, serviceContext)

			// Network error gets shorter delay
			const networkError = new Error("network connection failed")
			const networkContext = createContext({ retryAttempt: baseRetryAttempt })
			const networkResult = UnifiedErrorHandler.handle(networkError, networkContext)

			expect(serviceResult.retryDelay).toBeGreaterThan(networkResult.retryDelay!)
		})

		test("extracts provider-specific retry delay", () => {
			// Simulate Google Gemini retry info
			const error = {
				message: "Rate limit exceeded",
				errorDetails: [
					{
						"@type": "type.googleapis.com/google.rpc.RetryInfo",
						retryDelay: "30s",
					},
				],
			}
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.retryDelay).toBe(31) // 30s + 1s buffer
		})
	})

	describe("error message formatting", () => {
		test("formats error message with context", () => {
			const error = new Error("Test error message")
			const context = createContext({
				provider: "anthropic",
				modelId: "claude-3-sonnet",
				retryAttempt: 2,
			})

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.formattedMessage).toContain("[anthropic:claude-3-sonnet]")
			expect(result.formattedMessage).toContain("Test error message")
			expect(result.formattedMessage).toContain("(Retry 2)")
		})

		test("includes error type in formatted message", () => {
			const error = { status: 429, message: "Rate limit exceeded" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.formattedMessage).toContain("[THROTTLING]")
		})

		test("handles non-Error objects", () => {
			const error = { someProperty: "not an Error object" }
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.formattedMessage).toContain("Unknown error")
		})

		test("cleans up whitespace in error messages", () => {
			const error = new Error("Error   with    extra     whitespace")
			const context = createContext()

			const result = UnifiedErrorHandler.handle(error, context)
			expect(result.formattedMessage).toContain("Error with extra whitespace")
		})
	})
})
