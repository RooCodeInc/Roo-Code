// npx vitest core/task/__tests__/api-retry-performance.spec.ts

import { describe, it, expect, beforeEach } from "vitest"
import { TaskStateLock, GlobalRateLimitManager } from "../TaskStateLock"
import { StreamStateManager } from "../StreamStateManager"
import { UnifiedErrorHandler } from "../../../api/error-handling/UnifiedErrorHandler"

describe("API Retry Performance Tests", () => {
	beforeEach(() => {
		TaskStateLock.clearAllLocks()
		GlobalRateLimitManager.reset()
	})

	describe("Lock Performance", () => {
		it("should handle high-frequency lock operations efficiently", async () => {
			const lockKey = "perf-test-1"
			const iterations = 1000

			const startTime = Date.now()

			for (let i = 0; i < iterations; i++) {
				const release = await TaskStateLock.acquire(lockKey)
				release()
			}

			const endTime = Date.now()
			const duration = endTime - startTime
			const avgTime = duration / iterations

			console.log(
				`Lock acquire/release: ${iterations} iterations in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`,
			)

			// Should complete quickly - less than 1ms per operation on average
			expect(avgTime).toBeLessThan(1)
		})

		it("should handle concurrent lock attempts efficiently", async () => {
			const lockKey = "perf-test-2"
			const concurrentAttempts = 100

			const startTime = Date.now()

			// Create many concurrent lock attempts
			const attempts = Array(concurrentAttempts)
				.fill(null)
				.map(async (_, index) => {
					const release = await TaskStateLock.tryAcquire(lockKey)
					if (release) {
						// Hold lock briefly
						await new Promise((resolve) => setTimeout(resolve, 1))
						release()
						return true
					}
					return false
				})

			const results = await Promise.all(attempts)

			const endTime = Date.now()
			const duration = endTime - startTime

			const successCount = results.filter((r) => r).length
			console.log(
				`Concurrent attempts: ${concurrentAttempts} attempts in ${duration}ms (${successCount} succeeded)`,
			)

			// Only one should succeed
			expect(successCount).toBe(1)
			// Should complete quickly
			expect(duration).toBeLessThan(100)
		})
	})

	describe("Rate Limit Performance", () => {
		it("should calculate rate limits efficiently", async () => {
			const iterations = 1000

			// Set initial timestamp
			await GlobalRateLimitManager.updateLastRequestTime()

			const startTime = Date.now()

			for (let i = 0; i < iterations; i++) {
				await GlobalRateLimitManager.calculateRateLimitDelay(1)
			}

			const endTime = Date.now()
			const duration = endTime - startTime
			const avgTime = duration / iterations

			console.log(
				`Rate limit calculations: ${iterations} iterations in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`,
			)

			// Should be very fast - less than 0.1ms per calculation
			expect(avgTime).toBeLessThan(0.1)
		})
	})

	describe("Error Handler Performance", () => {
		it("should classify errors efficiently", () => {
			const iterations = 1000
			const errors = [
				new Error("Rate limit exceeded"),
				new Error("Service unavailable"),
				new Error("Network timeout"),
				new Error("Access denied"),
				new Error("Generic error"),
			]

			const context = {
				isStreaming: false,
				provider: "test",
				modelId: "test-model",
				retryAttempt: 0,
			}

			const startTime = Date.now()

			for (let i = 0; i < iterations; i++) {
				const error = errors[i % errors.length]
				UnifiedErrorHandler.handle(error, context)
			}

			const endTime = Date.now()
			const duration = endTime - startTime
			const avgTime = duration / iterations

			console.log(
				`Error classification: ${iterations} iterations in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`,
			)

			// Should be very fast - less than 0.1ms per classification
			expect(avgTime).toBeLessThan(0.1)
		})
	})

	describe("Stream State Manager Performance", () => {
		it("should handle stream state operations efficiently", async () => {
			const mockTask = {
				id: "perf-test",
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
					revertChanges: async () => {},
					reset: async () => {},
				},
			}

			const iterations = 100
			const startTime = Date.now()

			for (let i = 0; i < iterations; i++) {
				const streamManager = new StreamStateManager(mockTask as any)
				await streamManager.prepareForStreaming()
				streamManager.markStreamingStarted()
				streamManager.markStreamingCompleted()
			}

			const endTime = Date.now()
			const duration = endTime - startTime
			const avgTime = duration / iterations

			console.log(`Stream lifecycle: ${iterations} iterations in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`)

			// Should be reasonably fast - less than 1ms per full lifecycle
			expect(avgTime).toBeLessThan(1)
		})
	})
})
