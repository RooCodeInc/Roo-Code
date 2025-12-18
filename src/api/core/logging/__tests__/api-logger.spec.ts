/**
 * @fileoverview Tests for the centralized API logging service
 */

// Mock env-config to control logging in tests
vi.mock("../env-config", () => ({
	isLoggingEnabled: vi.fn(() => true),
}))

import { ApiLogger, ApiLoggerService } from "../api-logger"
import type { ApiLogContext, ApiRequestLog, ApiResponseLog } from "../types"
import { isLoggingEnabled } from "../env-config"

describe("ApiLoggerService", () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.clearAllMocks()
		// Enable logging via mocked isLoggingEnabled
		vi.mocked(isLoggingEnabled).mockReturnValue(true)
		// Mock console.log and console.error
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		// Reset to default configuration
		ApiLogger.configure({
			enabled: true,
			logRequests: true,
			logResponses: true,
			logErrors: true,
			onLog: undefined,
		})
		ApiLogger.clearTimestamps()
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	describe("logRequest", () => {
		const baseContext: Omit<ApiLogContext, "requestId"> = {
			provider: "test-provider",
			model: "test-model",
			operation: "createMessage",
			taskId: "task-123",
		}

		const baseRequest = {
			systemPromptLength: 100,
			messageCount: 5,
			hasTools: true,
			toolCount: 3,
			stream: true,
		}

		it("should generate and return a unique requestId", () => {
			const requestId = ApiLogger.logRequest(baseContext, baseRequest)

			expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/)
		})

		it("should generate unique requestIds for each call", () => {
			const requestId1 = ApiLogger.logRequest(baseContext, baseRequest)
			const requestId2 = ApiLogger.logRequest(baseContext, baseRequest)

			expect(requestId1).not.toBe(requestId2)
		})

		it("should log request details to the logger", () => {
			ApiLogger.logRequest(baseContext, baseRequest)

			// First call is the request header
			expect(consoleLogSpy).toHaveBeenCalledWith("[API Request] test-provider test-model createMessage")
			// Second call is the metadata (since no rawBody)
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[API Request Metadata]",
				expect.objectContaining({
					taskId: "task-123",
					messageCount: 5,
					hasTools: true,
					toolCount: 3,
					stream: true,
				}),
			)
		})

		it("should log raw body when provided", () => {
			const rawBody = { model: "test", messages: [{ role: "user", content: "hello" }] }
			ApiLogger.logRequest(baseContext, { ...baseRequest, rawBody })

			// First call is the request header
			expect(consoleLogSpy).toHaveBeenCalledWith("[API Request] test-provider test-model createMessage")
			// Second call is the raw body as JSON
			expect(consoleLogSpy).toHaveBeenCalledWith("[API Request Body]", JSON.stringify(rawBody, null, 2))
		})

		it("should track the request timestamp for duration calculation", () => {
			expect(ApiLogger.getTrackedRequestCount()).toBe(0)

			ApiLogger.logRequest(baseContext, baseRequest)

			expect(ApiLogger.getTrackedRequestCount()).toBe(1)
		})

		it("should not log when logging is disabled", () => {
			ApiLogger.configure({ enabled: false })

			const requestId = ApiLogger.logRequest(baseContext, baseRequest)

			expect(requestId).toBeDefined()
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("should still track timestamps when logging is disabled", () => {
			ApiLogger.configure({ enabled: false })

			ApiLogger.logRequest(baseContext, baseRequest)

			expect(ApiLogger.getTrackedRequestCount()).toBe(1)
		})

		it("should not log when logRequests is false", () => {
			ApiLogger.configure({ logRequests: false })

			ApiLogger.logRequest(baseContext, baseRequest)

			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("should call onLog callback when configured", () => {
			const onLog = vi.fn()
			ApiLogger.configure({ onLog })

			ApiLogger.logRequest(baseContext, baseRequest)

			expect(onLog).toHaveBeenCalledWith(
				"request",
				expect.objectContaining({
					context: expect.objectContaining({
						provider: "test-provider",
						model: "test-model",
					}),
					request: baseRequest,
				}),
			)
		})
	})

	describe("logResponse", () => {
		const baseContext: Omit<ApiLogContext, "requestId"> = {
			provider: "test-provider",
			model: "test-model",
			operation: "createMessage",
			taskId: "task-123",
		}

		const baseResponse = {
			textLength: 1000,
			reasoningLength: 500,
			toolCallCount: 2,
			usage: {
				inputTokens: 100,
				outputTokens: 200,
				cacheReadTokens: 50,
				cacheWriteTokens: 30,
				totalCost: 0.005,
			},
		}

		it("should log response details with duration", async () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })

			// Small delay to ensure duration > 0
			await new Promise((resolve) => setTimeout(resolve, 10))

			ApiLogger.logResponse(requestId, baseContext, baseResponse)

			// Check console.log was called for the response (second call after request)
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[API Response] test-provider test-model createMessage"),
				expect.objectContaining({
					requestId,
					success: true,
					textLength: 1000,
					reasoningLength: 500,
					toolCallCount: 2,
					inputTokens: 100,
					outputTokens: 200,
					totalCost: 0.005,
				}),
			)
		})

		it("should clean up tracked timestamps", () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			expect(ApiLogger.getTrackedRequestCount()).toBe(1)

			ApiLogger.logResponse(requestId, baseContext, baseResponse)

			expect(ApiLogger.getTrackedRequestCount()).toBe(0)
		})

		it("should handle missing timestamp gracefully", () => {
			ApiLogger.logResponse("unknown-request-id", baseContext, baseResponse)

			// The response should still log, but duration calculation handles missing timestamp
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[API Response]"),
				expect.objectContaining({
					success: true,
				}),
			)
		})

		it("should not log when logResponses is false", () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			vi.clearAllMocks()

			ApiLogger.configure({ logResponses: false })
			ApiLogger.logResponse(requestId, baseContext, baseResponse)

			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("should still clean up timestamps when logging is disabled", () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			expect(ApiLogger.getTrackedRequestCount()).toBe(1)

			ApiLogger.configure({ enabled: false })
			ApiLogger.logResponse(requestId, baseContext, baseResponse)

			expect(ApiLogger.getTrackedRequestCount()).toBe(0)
		})

		it("should call onLog callback with response log", () => {
			const onLog = vi.fn()
			ApiLogger.configure({ onLog })

			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			ApiLogger.logResponse(requestId, baseContext, baseResponse)

			expect(onLog).toHaveBeenCalledWith(
				"response",
				expect.objectContaining({
					response: expect.objectContaining({
						success: true,
						textLength: 1000,
					}),
				}),
			)
		})
	})

	describe("logError", () => {
		const baseContext: Omit<ApiLogContext, "requestId"> = {
			provider: "test-provider",
			model: "test-model",
			operation: "createMessage",
			taskId: "task-123",
		}

		const baseError = {
			message: "Rate limit exceeded",
			code: 429,
			isRetryable: true,
		}

		it("should log error details", () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			vi.clearAllMocks()

			ApiLogger.logError(requestId, baseContext, baseError)

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[API Error] test-provider test-model createMessage"),
				expect.objectContaining({
					requestId,
					errorMessage: "Rate limit exceeded",
					errorCode: 429,
					isRetryable: true,
				}),
			)
		})

		it("should clean up tracked timestamps", () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			expect(ApiLogger.getTrackedRequestCount()).toBe(1)

			ApiLogger.logError(requestId, baseContext, baseError)

			expect(ApiLogger.getTrackedRequestCount()).toBe(0)
		})

		it("should not log when logErrors is false", () => {
			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			vi.clearAllMocks()

			ApiLogger.configure({ logErrors: false })
			ApiLogger.logError(requestId, baseContext, baseError)

			expect(consoleErrorSpy).not.toHaveBeenCalled()
		})

		it("should call onLog callback with error response", () => {
			const onLog = vi.fn()
			ApiLogger.configure({ onLog })

			const requestId = ApiLogger.logRequest(baseContext, { messageCount: 1 })
			ApiLogger.logError(requestId, baseContext, baseError)

			expect(onLog).toHaveBeenCalledWith(
				"response",
				expect.objectContaining({
					response: expect.objectContaining({
						success: false,
						error: baseError,
					}),
				}),
			)
		})
	})

	describe("configure", () => {
		it("should merge partial configuration", () => {
			ApiLogger.configure({ logRequests: false })

			const config = ApiLogger.getConfig()

			expect(config.enabled).toBe(true)
			expect(config.logRequests).toBe(false)
			expect(config.logResponses).toBe(true)
		})

		it("should allow setting all configuration options", () => {
			const onLog = vi.fn()

			ApiLogger.configure({
				enabled: false,
				logRequests: false,
				logResponses: false,
				logErrors: false,
				onLog,
			})

			const config = ApiLogger.getConfig()

			expect(config.enabled).toBe(false)
			expect(config.logRequests).toBe(false)
			expect(config.logResponses).toBe(false)
			expect(config.logErrors).toBe(false)
			expect(config.onLog).toBe(onLog)
		})
	})

	describe("clearTimestamps", () => {
		it("should clear all tracked timestamps", () => {
			const context = {
				provider: "test",
				model: "test",
				operation: "createMessage" as const,
			}

			ApiLogger.logRequest(context, {})
			ApiLogger.logRequest(context, {})
			ApiLogger.logRequest(context, {})

			expect(ApiLogger.getTrackedRequestCount()).toBe(3)

			ApiLogger.clearTimestamps()

			expect(ApiLogger.getTrackedRequestCount()).toBe(0)
		})
	})

	describe("singleton behavior", () => {
		it("should export a singleton instance", () => {
			expect(ApiLogger).toBeInstanceOf(ApiLoggerService)
		})
	})
})
