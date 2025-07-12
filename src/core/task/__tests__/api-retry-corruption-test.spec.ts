// npx vitest core/task/__tests__/api-retry-corruption-test.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Task } from "../Task"
import { TaskStateLock } from "../TaskStateLock"
import { StreamStateManager } from "../StreamStateManager"
import { UnifiedErrorHandler } from "../../../api/error-handling/UnifiedErrorHandler"
import { ClineApiReqCancelReason } from "../../../shared/ExtensionMessage"
import { EventBus } from "../../events/EventBus"
import { StreamEventType } from "../../events/types"
import { DependencyContainer, ServiceKeys, initializeContainer } from "../../di/DependencyContainer"
import { IRateLimitManager } from "../../interfaces/IRateLimitManager"

describe("API Retry Task Corruption Prevention Tests", () => {
	let mockTask: any
	let taskStateLock: TaskStateLock
	let globalRateLimitManager: IRateLimitManager

	beforeEach(() => {
		vi.clearAllMocks()

		// Reset and initialize dependency container
		DependencyContainer.reset()
		initializeContainer()

		// Get instances from container
		const container = DependencyContainer.getInstance()
		taskStateLock = container.resolve<TaskStateLock>(ServiceKeys.TASK_STATE_LOCK)
		globalRateLimitManager = container.resolve<IRateLimitManager>(ServiceKeys.GLOBAL_RATE_LIMIT_MANAGER)

		// Create a mock task with required properties
		mockTask = {
			id: "test-task",
			abortController: new AbortController(),
			abort: false,
			abandoned: false,
			isStreaming: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			userMessageContent: [],
			userMessageContentReady: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			didCompleteReadingStream: false,
			didFinishAbortingStream: false,
			isWaitingForFirstChunk: false,
			clineMessages: [],
			diffViewProvider: {
				isEditing: false,
				revertChanges: vi.fn().mockResolvedValue(undefined),
				reset: vi.fn().mockResolvedValue(undefined),
			},
		}

		// Clear task locks
		taskStateLock.clearAllLocks()
	})

	afterEach(() => {
		// Cleanup
		taskStateLock.clearAllLocks()
	})

	describe("Race Condition Prevention", () => {
		it("should prevent concurrent API requests using TaskStateLock", async () => {
			const lockKey = "test-lock-1"

			// First request acquires lock
			const release1 = await taskStateLock.tryAcquire(lockKey)
			expect(release1).toBeTruthy()

			// Second request should fail to acquire
			const release2 = await taskStateLock.tryAcquire(lockKey)
			expect(release2).toBeNull()

			// Release first lock
			release1!()

			// Now second request can acquire
			const release3 = await taskStateLock.tryAcquire(lockKey)
			expect(release3).toBeTruthy()

			release3!()
		})

		it("should enforce global rate limiting", async () => {
			// Update last request time
			await globalRateLimitManager.updateLastRequestTime()

			// Calculate delay immediately - should need to wait
			const delay1 = await globalRateLimitManager.calculateDelay(1)
			expect(delay1).toBeGreaterThan(0)
			expect(delay1).toBeLessThanOrEqual(1000) // delay is in milliseconds

			// Wait for rate limit to pass
			await new Promise((resolve) => setTimeout(resolve, 1100))

			// Now should not need to wait
			const delay2 = await globalRateLimitManager.calculateDelay(1)
			expect(delay2).toBe(0)
		})

		it("should execute operations atomically with locks", async () => {
			const lockKey = "test-lock-2"
			let counter = 0

			// Run multiple concurrent operations
			const operations = Array(5)
				.fill(null)
				.map(async (_, index) => {
					await taskStateLock.withLock(lockKey, async () => {
						const current = counter
						// Simulate async work
						await new Promise((resolve) => setTimeout(resolve, 10))
						counter = current + 1
					})
				})

			await Promise.all(operations)

			// All operations should have executed sequentially
			expect(counter).toBe(5)
		})
	})

	describe("Stream State Management", () => {
		it("should properly track and cleanup streams", async () => {
			const eventBus = new EventBus()
			const streamManager = new StreamStateManager(mockTask.id, eventBus)

			// Track state changes via events
			let streamStarted = false
			let streamCompleted = false

			eventBus.on(StreamEventType.STREAM_STARTED, () => {
				streamStarted = true
			})

			eventBus.on(StreamEventType.STREAM_COMPLETED, () => {
				streamCompleted = true
			})

			// Prepare for streaming
			await streamManager.prepareForStreaming()
			const state1 = streamManager.getState()
			expect(state1.isStreaming).toBe(false)
			expect(state1.isWaitingForFirstChunk).toBe(false)

			// Start stream
			streamManager.markStreamingStarted()
			const state2 = streamManager.getState()
			expect(state2.isStreaming).toBe(true)
			expect(streamStarted).toBe(true)

			// Complete stream
			streamManager.markStreamingCompleted()
			const state3 = streamManager.getState()
			expect(state3.isStreaming).toBe(false)
			expect(state3.didCompleteReadingStream).toBe(true)
			expect(streamCompleted).toBe(true)
		})

		it("should handle abort during stream", async () => {
			const eventBus = new EventBus()
			const streamManager = new StreamStateManager(mockTask.id, eventBus)

			let streamAborted = false
			let diffViewRevertRequested = false

			eventBus.on(StreamEventType.STREAM_ABORTED, () => {
				streamAborted = true
			})

			eventBus.on(StreamEventType.DIFF_UPDATE_NEEDED, (event) => {
				if (event.action === "revert") {
					diffViewRevertRequested = true
					// In real Task, this would trigger the actual revert
					if (mockTask.diffViewProvider.isEditing) {
						mockTask.diffViewProvider.revertChanges()
					}
				}
			})

			streamManager.markStreamingStarted()
			const state1 = streamManager.getState()
			expect(state1.isStreaming).toBe(true)

			// Set isEditing to true so revertChanges gets called
			mockTask.diffViewProvider.isEditing = true

			// Simulate abort
			await streamManager.abortStreamSafely("user_cancelled" as ClineApiReqCancelReason)

			// Should emit abort event
			expect(streamAborted).toBe(true)
			expect(diffViewRevertRequested).toBe(true)
			expect(mockTask.diffViewProvider.revertChanges).toHaveBeenCalled()

			// Check final state
			const finalState = streamManager.getState()
			expect(finalState.isStreaming).toBe(false)
			expect(finalState.didFinishAbortingStream).toBe(true)
			expect(finalState.assistantMessageContent).toHaveLength(0)
			expect(finalState.userMessageContent).toHaveLength(0)
		})

		it("should check stream safety correctly", async () => {
			const eventBus = new EventBus()
			const streamManager = new StreamStateManager(mockTask.id, eventBus)

			// Initially not streaming, so not safe
			expect(streamManager.isStreamSafe()).toBe(false)

			// Start streaming - now safe
			streamManager.markStreamingStarted()
			expect(streamManager.isStreamSafe()).toBe(true)

			// During abort, not safe
			const abortPromise = streamManager.abortStreamSafely("user_cancelled" as ClineApiReqCancelReason)
			expect(streamManager.isStreamSafe()).toBe(false)

			// Wait for abort to complete
			await abortPromise

			// After abort, not streaming so not safe
			expect(streamManager.isStreamSafe()).toBe(false)
		})

		it("should handle partial message cleanup", async () => {
			const eventBus = new EventBus()
			const streamManager = new StreamStateManager(mockTask.id, eventBus)

			let partialMessageCleanupRequested = false

			// Add a partial message
			mockTask.clineMessages = [
				{
					partial: true,
					content: "Test message",
				},
			]

			// Mock saveClineMessages
			mockTask.saveClineMessages = vi.fn().mockResolvedValue(undefined)

			eventBus.on(StreamEventType.PARTIAL_MESSAGE_CLEANUP_NEEDED, () => {
				partialMessageCleanupRequested = true
				// In real Task, this would handle the cleanup
				if (mockTask.clineMessages.length > 0) {
					mockTask.clineMessages[mockTask.clineMessages.length - 1].partial = false
					mockTask.saveClineMessages()
				}
			})

			await streamManager.abortStreamSafely("streaming_failed" as ClineApiReqCancelReason, "Test error")

			// Cleanup should have been requested
			expect(partialMessageCleanupRequested).toBe(true)
			expect(mockTask.clineMessages[0].partial).toBe(false)
			expect(mockTask.saveClineMessages).toHaveBeenCalled()
		})
	})

	describe("Error Context Consistency", () => {
		it("should maintain consistent error context across retries", () => {
			const context = {
				isStreaming: false,
				provider: "test-provider",
				modelId: "test-model",
				retryAttempt: 1,
			}

			// First error
			const error1 = new Error("API Error 1")
			const response1 = UnifiedErrorHandler.handle(error1, context)

			expect(response1.errorType).toBeDefined()
			expect(response1.shouldRetry).toBeDefined()
			expect(response1.retryDelay).toBeDefined()

			// Second error (retry)
			context.retryAttempt = 2
			const error2 = new Error("API Error 2")
			const response2 = UnifiedErrorHandler.handle(error2, context)

			// Error type classification should be consistent
			expect(response2.errorType).toBe("GENERIC")
			expect(response2.formattedMessage).toContain("Retry 2")
		})

		it("should handle provider-specific errors correctly", () => {
			const context = {
				isStreaming: true,
				provider: "anthropic",
				modelId: "claude-3",
				retryAttempt: 0,
			}

			// Simulate rate limit error
			const rateLimitError: any = new Error("Rate limit exceeded")
			rateLimitError.status = 429

			const response = UnifiedErrorHandler.handle(rateLimitError, context)

			expect(response.errorType).toBe("THROTTLING")
			expect(response.shouldRetry).toBe(true)
			expect(response.shouldThrow).toBe(true) // Should throw in streaming context
			expect(response.retryDelay).toBeGreaterThan(0)
		})

		it("should provide stream chunks for non-throwing errors", () => {
			const context = {
				isStreaming: true,
				provider: "test",
				modelId: "test-model",
				retryAttempt: 0,
			}

			const error = new Error("Service temporarily unavailable")
			const response = UnifiedErrorHandler.handle(error, context)

			expect(response.streamChunks).toBeDefined()
			expect(response.streamChunks).toHaveLength(2)
			expect(response.streamChunks![0].type).toBe("text")
			expect(response.streamChunks![1].type).toBe("usage")
		})
	})

	describe("Integration: Task with New Components", () => {
		it("should prevent corruption during concurrent retry attempts", async () => {
			const lockKey = "api-request-lock"
			const results: string[] = []

			// Create multiple tasks that will try to make API requests simultaneously
			const tasks = Array(3)
				.fill(null)
				.map((_, index) => {
					return (async () => {
						try {
							// Try to acquire lock
							const release = await taskStateLock.tryAcquire(lockKey)
							if (!release) {
								results.push(`Task ${index}: Lock denied`)
								return
							}

							results.push(`Task ${index}: Lock acquired`)

							// Simulate API work
							await new Promise((resolve) => setTimeout(resolve, 50))

							results.push(`Task ${index}: Work completed`)

							// Release lock
							release()
						} catch (error) {
							results.push(`Task ${index}: Error - ${error.message}`)
						}
					})()
				})

			// Run all tasks concurrently
			await Promise.all(tasks)

			// Verify only one task got the lock
			const lockAcquiredCount = results.filter((r) => r.includes("Lock acquired")).length
			expect(lockAcquiredCount).toBe(1)

			// Verify others were denied
			const lockDeniedCount = results.filter((r) => r.includes("Lock denied")).length
			expect(lockDeniedCount).toBe(2)

			// Verify the one that got the lock completed successfully
			const completedCount = results.filter((r) => r.includes("Work completed")).length
			expect(completedCount).toBe(1)
		})

		it("should handle stream abortion gracefully with proper cleanup", async () => {
			const eventBus = new EventBus()
			const streamManager = new StreamStateManager(mockTask.id, eventBus)

			streamManager.markStreamingStarted()

			// Start async operation
			const streamPromise = (async () => {
				try {
					// Simulate streaming
					for (let i = 0; i < 5; i++) {
						if (!streamManager.isStreamSafe()) {
							throw new Error("Stream aborted")
						}
						await new Promise((resolve) => setTimeout(resolve, 10))
					}
					return "completed"
				} catch (error) {
					const context = {
						isStreaming: true,
						provider: "test",
						modelId: "test-model",
					}
					const response = UnifiedErrorHandler.handle(error, context)
					return response
				} finally {
					streamManager.forceCleanup()
				}
			})()

			// Abort after a short delay
			setTimeout(async () => {
				await streamManager.abortStreamSafely("user_cancelled" as ClineApiReqCancelReason)
			}, 25)

			const result = await streamPromise

			// Should have been aborted
			expect(result).toHaveProperty("formattedMessage")
			expect((result as any).formattedMessage).toContain("Stream aborted")

			const finalState = streamManager.getState()
			expect(finalState.isStreaming).toBe(false)
		})

		it("should maintain state consistency across retry cycles", async () => {
			const lockKey = "retry-test"
			let attemptCount = 0
			const maxAttempts = 3

			const performApiCall = async (): Promise<any> => {
				const release = await taskStateLock.acquire(lockKey)

				try {
					attemptCount++

					// Simulate failure on first attempts
					if (attemptCount < maxAttempts) {
						throw new Error("Temporary failure")
					}

					return { success: true, attempts: attemptCount }
				} finally {
					release()
				}
			}

			// Retry logic
			let result
			for (let i = 0; i < maxAttempts; i++) {
				try {
					result = await performApiCall()
					break
				} catch (error) {
					if (i === maxAttempts - 1) throw error
					// Wait before retry
					await new Promise((resolve) => setTimeout(resolve, 100))
				}
			}

			expect(result).toEqual({ success: true, attempts: 3 })
			expect(attemptCount).toBe(3)
		})
	})
})
