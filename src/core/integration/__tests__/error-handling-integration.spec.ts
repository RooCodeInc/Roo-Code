import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Task } from "../../task/Task"
import { UnifiedErrorHandler } from "../../../api/error-handling/UnifiedErrorHandler"
import { ErrorAnalyzer } from "../../../api/error-handling/ErrorAnalyzer"
import { RetryStrategyFactory } from "../../../api/retry/RetryStrategyFactory"
import { ExponentialBackoffStrategy } from "../../../api/retry/ExponentialBackoffStrategy"
import { LinearBackoffStrategy } from "../../../api/retry/LinearBackoffStrategy"
import { NoRetryStrategy } from "../../../api/retry/NoRetryStrategy"
import { StreamStateManager } from "../../task/StreamStateManager"
import { TaskStateLock } from "../../task/TaskStateLock"
import { EventBus } from "../../events/EventBus"
import { EventBusProvider } from "../../events/EventBusProvider"
import { UIEventHandler } from "../../ui/UIEventHandler"
import { DependencyContainer, ServiceKeys, initializeContainer } from "../../di/DependencyContainer"
import { StreamEventType, DiffUpdateEvent } from "../../events/types"
import { ErrorType } from "../../interfaces/types"
import { ClineApiReqCancelReason } from "../../../shared/ExtensionMessage"
import { IRateLimitManager } from "../../interfaces/IRateLimitManager"

describe("Error Handling Integration Tests", () => {
	let container: DependencyContainer
	let eventBus: EventBus
	let errorHandler: UnifiedErrorHandler
	let errorAnalyzer: ErrorAnalyzer
	let retryStrategyFactory: RetryStrategyFactory
	let taskStateLock: TaskStateLock
	let mockDiffViewProvider: any
	let mockClineProvider: any
	let mockTask: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Reset and initialize dependency container
		DependencyContainer.reset()
		initializeContainer()
		container = DependencyContainer.getInstance()

		// Get test-specific event bus
		eventBus = EventBusProvider.createTestInstance("integration-test")

		// Initialize components
		errorAnalyzer = new ErrorAnalyzer()
		retryStrategyFactory = new RetryStrategyFactory()
		errorHandler = new UnifiedErrorHandler(errorAnalyzer, retryStrategyFactory)
		taskStateLock = container.resolve<TaskStateLock>(ServiceKeys.TASK_STATE_LOCK)

		// Create mock providers
		mockDiffViewProvider = {
			isEditing: false,
			revertChanges: vi.fn().mockResolvedValue(undefined),
			reset: vi.fn().mockResolvedValue(undefined),
			applyChanges: vi.fn().mockResolvedValue(undefined),
		}

		mockClineProvider = {
			postMessageToWebview: vi.fn(),
			saveClineMessages: vi.fn().mockResolvedValue(undefined),
			addToConversationHistory: vi.fn(),
		}

		// Create mock task
		mockTask = {
			id: "test-task-integration",
			abortController: new AbortController(),
			clineMessages: [],
			diffViewProvider: mockDiffViewProvider,
			clineProvider: mockClineProvider,
			attemptApiRequest: vi.fn(),
			say: vi.fn(),
		}
	})

	afterEach(() => {
		EventBusProvider.clearTestInstance("integration-test")
		taskStateLock.clearAllLocks()
	})

	describe("End-to-End Error Handling Flow", () => {
		it("should handle throttling errors with exponential backoff retry", async () => {
			const context = {
				isStreaming: false,
				provider: "anthropic",
				modelId: "claude-3",
				retryAttempt: 0,
			}

			// Create throttling error
			const throttlingError: any = new Error("Rate limit exceeded")
			throttlingError.status = 429

			// Analyze error
			const errorInfo = errorAnalyzer.analyze(throttlingError, context)
			expect(errorInfo.errorType).toBe("THROTTLING")
			expect(errorInfo.isRetryable).toBe(true)

			// Get retry strategy
			const strategy = retryStrategyFactory.createStrategy(errorInfo.errorType)
			expect(strategy).toBeInstanceOf(ExponentialBackoffStrategy)

			// Check retry behavior
			expect(strategy.shouldRetry(errorInfo.errorType, 1)).toBe(true)
			const delay1 = strategy.calculateDelay(errorInfo.errorType, 1)
			expect(delay1).toBe(10) // 5 * 2^1

			const delay2 = strategy.calculateDelay(errorInfo.errorType, 2)
			expect(delay2).toBe(20) // 5 * 2^2

			const delay3 = strategy.calculateDelay(errorInfo.errorType, 3)
			expect(delay3).toBe(40) // 5 * 2^3

			// Handle through UnifiedErrorHandler
			const response = errorHandler.handle(throttlingError, context)
			expect(response.errorType).toBe("THROTTLING")
			expect(response.shouldRetry).toBe(true)
			expect(response.retryDelay).toBe(5) // 5 seconds base delay
			expect(response.formattedMessage).toContain("Rate limit exceeded")
		})

		it("should handle network errors with linear backoff retry", async () => {
			const context = {
				isStreaming: false,
				provider: "openai",
				modelId: "gpt-4",
				retryAttempt: 0,
			}

			// Configure factory for linear strategy on network errors
			const customFactory = new RetryStrategyFactory({
				errorTypeStrategies: {
					["NETWORK_ERROR"]: "linear",
				},
			})
			const customErrorHandler = new UnifiedErrorHandler(errorAnalyzer, customFactory)

			// Create network error with proper message pattern
			const networkError: any = new Error("Network connection failed")
			networkError.code = "ECONNREFUSED"

			// Analyze error
			const errorInfo = errorAnalyzer.analyze(networkError, context)
			expect(errorInfo.errorType).toBe("NETWORK_ERROR")
			expect(errorInfo.isRetryable).toBe(true)

			// Get retry strategy
			const strategy = customFactory.createStrategy(errorInfo.errorType)
			expect(strategy).toBeInstanceOf(LinearBackoffStrategy)

			// Check retry behavior (LinearBackoffStrategy: base 3s + attempt * 2s)
			const delay1 = strategy.calculateDelay(errorInfo.errorType, 1)
			expect(delay1).toBe(3.5) // (3 + 1*2) * 0.7 for network errors

			const delay2 = strategy.calculateDelay(errorInfo.errorType, 2)
			expect(delay2).toBeCloseTo(4.9, 1) // (3 + 2*2) * 0.7 for network errors

			// Handle through custom error handler
			const response = customErrorHandler.handle(networkError, context)
			expect(response.errorType).toBe("NETWORK_ERROR")
			expect(response.shouldRetry).toBe(true)
			expect(response.retryDelay).toBeCloseTo(2.1, 1) // (3 + 0*2) * 0.7 for network errors (first attempt)
		})

		it("should handle non-retryable errors with no retry strategy", async () => {
			const context = {
				isStreaming: false,
				provider: "anthropic",
				modelId: "claude-3",
				retryAttempt: 0,
			}

			// Create access denied error
			const accessError: any = new Error("Access denied")
			accessError.status = 403

			// Analyze error
			const errorInfo = errorAnalyzer.analyze(accessError, context)
			expect(errorInfo.errorType).toBe("ACCESS_DENIED")
			expect(errorInfo.isRetryable).toBe(false)

			// Get retry strategy
			const strategy = retryStrategyFactory.createStrategy(errorInfo.errorType)
			expect(strategy).toBeInstanceOf(NoRetryStrategy)

			// Check retry behavior
			expect(strategy.shouldRetry(errorInfo.errorType, 1)).toBe(false)
			expect(strategy.calculateDelay(errorInfo.errorType, 1)).toBe(0)

			// Handle through UnifiedErrorHandler
			const response = errorHandler.handle(accessError, context)
			expect(response.errorType).toBe("ACCESS_DENIED")
			expect(response.shouldRetry).toBe(false)
			expect(response.retryDelay).toBe(0)
		})
	})

	describe("Stream State Management with Error Handling", () => {
		it("should handle errors during streaming with proper cleanup", async () => {
			const streamManager = new StreamStateManager(mockTask.id, eventBus)
			const uiEventHandler = new UIEventHandler(mockTask.id, eventBus, mockDiffViewProvider)

			let diffUpdateEvents: DiffUpdateEvent[] = []
			let streamAborted = false

			// Track events
			eventBus.on(StreamEventType.DIFF_UPDATE_NEEDED, (event) => {
				diffUpdateEvents.push(event)
			})

			eventBus.on(StreamEventType.STREAM_ABORTED, () => {
				streamAborted = true
			})

			// Start streaming
			streamManager.markStreamingStarted()
			expect(streamManager.getState().isStreaming).toBe(true)

			// Simulate streaming error
			const streamError = new Error("Stream connection lost")
			const context = {
				isStreaming: true,
				provider: "anthropic",
				modelId: "claude-3",
				retryAttempt: 0,
			}

			const response = errorHandler.handle(streamError, context)
			expect(response.errorType).toBe("NETWORK_ERROR")
			expect(response.shouldRetry).toBe(true)

			// Abort stream due to error
			mockDiffViewProvider.isEditing = true
			await streamManager.abortStreamSafely(
				"streaming_failed" as ClineApiReqCancelReason,
				response.formattedMessage,
			)

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify cleanup
			expect(streamAborted).toBe(true)
			expect(diffUpdateEvents.some((e) => e.action === "revert")).toBe(true)
			expect(streamManager.getState().isStreaming).toBe(false)
			expect(streamManager.getState().didFinishAbortingStream).toBe(true)
		})

		it("should coordinate retry attempts with task state locking", async () => {
			const lockKey = "api-request-integration"
			let attemptCount = 0
			const maxRetries = 3

			const performApiCall = async (): Promise<any> => {
				const release = await taskStateLock.acquire(lockKey)

				try {
					attemptCount++

					// Simulate different errors on each attempt
					if (attemptCount === 1) {
						const error: any = new Error("Service temporarily unavailable")
						error.status = 503
						throw error
					} else if (attemptCount === 2) {
						throw new Error("ETIMEDOUT")
					}

					return { success: true, data: "API response" }
				} finally {
					release()
				}
			}

			// Retry logic with error handling
			let lastError: any
			let result: any

			for (let attempt = 0; attempt < maxRetries; attempt++) {
				try {
					result = await performApiCall()
					break
				} catch (error) {
					lastError = error

					const context = {
						isStreaming: false,
						provider: "test",
						modelId: "test-model",
						retryAttempt: attempt,
					}

					const response = errorHandler.handle(error, context)

					if (!response.shouldRetry || attempt === maxRetries - 1) {
						throw new Error(response.formattedMessage)
					}

					// Wait for retry delay
					await new Promise((resolve) => setTimeout(resolve, response.retryDelay || 0))
				}
			}

			expect(result).toEqual({ success: true, data: "API response" })
			expect(attemptCount).toBe(3)
		})
	})

	describe("Event-Driven UI Updates with Error Handling", () => {
		it("should update UI correctly when errors occur", async () => {
			const streamManager = new StreamStateManager(mockTask.id, eventBus)
			const uiEventHandler = new UIEventHandler(mockTask.id, eventBus, mockDiffViewProvider)

			// Track UI updates
			let errorDisplayed = false
			let progressUpdated = false

			eventBus.on(StreamEventType.ERROR_DISPLAY_NEEDED, () => {
				errorDisplayed = true
			})

			eventBus.on(StreamEventType.TASK_PROGRESS_UPDATE, () => {
				progressUpdated = true
			})

			// Start operation
			streamManager.markStreamingStarted()

			// Simulate error
			const error = new Error("API request failed")
			const context = {
				isStreaming: true,
				provider: "anthropic",
				modelId: "claude-3",
			}

			const response = errorHandler.handle(error, context)

			// Emit error display event
			eventBus.emitEvent(StreamEventType.ERROR_DISPLAY_NEEDED, {
				taskId: mockTask.id,
				timestamp: Date.now(),
				error: response.formattedMessage,
				isUserMessage: false,
				metadata: { errorType: response.errorType },
			})

			// Abort stream with editing state
			mockDiffViewProvider.isEditing = true
			await streamManager.abortStreamSafely("streaming_failed" as ClineApiReqCancelReason)

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify UI updates
			expect(errorDisplayed).toBe(true)
			expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		})
	})

	describe("Rate Limiting Integration", () => {
		it("should enforce rate limits across retry attempts", async () => {
			const rateLimitManager = container.resolve<IRateLimitManager>(ServiceKeys.GLOBAL_RATE_LIMIT_MANAGER)

			// Update last request time
			await rateLimitManager.updateLastRequestTime()

			// Try immediate retry - should be rate limited
			const delay1 = await rateLimitManager.calculateDelay(1)
			expect(delay1).toBeGreaterThan(0)

			// Create rate limit error
			const rateLimitError: any = new Error("Too many requests")
			rateLimitError.status = 429
			rateLimitError.headers = { "retry-after": "2" }
			rateLimitError.retryAfter = 2

			const context = {
				isStreaming: false,
				provider: "anthropic",
				modelId: "claude-3",
			}

			// Handle error
			const response = errorHandler.handle(rateLimitError, context)
			expect(response.errorType).toBe("THROTTLING")
			expect(response.shouldRetry).toBe(true)
			expect(response.retryDelay).toBe(5) // 5 seconds base delay

			// Wait and check again
			await new Promise((resolve) => setTimeout(resolve, 2100))
			const delay2 = await rateLimitManager.calculateDelay(1)
			expect(delay2).toBe(0)
		})
	})

	describe("Error Context Preservation", () => {
		it("should maintain context across retry cycles", async () => {
			const baseContext = {
				isStreaming: false,
				provider: "openai",
				modelId: "gpt-4",
				requestId: "test-request-123",
			}

			const errors = [
				new Error("Connection timeout"),
				new Error("Service unavailable"),
				new Error("Success"), // Not actually an error
			]

			const responses = []

			for (let i = 0; i < errors.length - 1; i++) {
				const context = { ...baseContext, retryAttempt: i }
				const response = errorHandler.handle(errors[i], context)
				responses.push(response)

				// Verify context is preserved
				expect(response.formattedMessage).toContain(errors[i].message)
				expect(response.shouldRetry).toBe(true)
			}

			// Verify retry delays increase
			expect(responses[0].retryDelay).toBeLessThan(responses[1].retryDelay!)
		})
	})
})
