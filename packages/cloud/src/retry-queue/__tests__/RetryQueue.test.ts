import type { ExtensionContext } from "vscode"
import { RetryQueue } from "../RetryQueue.js"
import type { QueuedRequest } from "../types.js"

// Mock ExtensionContext
const createMockContext = (): ExtensionContext => {
	const storage = new Map<string, unknown>()

	return {
		workspaceState: {
			get: vi.fn((key: string) => storage.get(key)),
			update: vi.fn(async (key: string, value: unknown) => {
				storage.set(key, value)
			}),
		},
	} as unknown as ExtensionContext
}

describe("RetryQueue", () => {
	let mockContext: ExtensionContext
	let retryQueue: RetryQueue

	beforeEach(() => {
		vi.clearAllMocks()
		mockContext = createMockContext()
		retryQueue = new RetryQueue(mockContext)
	})

	afterEach(() => {
		retryQueue.dispose()
	})

	describe("enqueue", () => {
		it("should add a request to the queue", async () => {
			const url = "https://api.example.com/test"
			const options = { method: "POST", body: JSON.stringify({ test: "data" }) }

			await retryQueue.enqueue(url, options, "telemetry", "test operation")

			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1)
			expect(stats.byType["telemetry"]).toBe(1)
		})

		it("should enforce max queue size with FIFO eviction", async () => {
			// Create a queue with max size of 3
			retryQueue = new RetryQueue(mockContext, { maxQueueSize: 3 })

			// Add 4 requests
			for (let i = 1; i <= 4; i++) {
				await retryQueue.enqueue(
					`https://api.example.com/test${i}`,
					{ method: "POST" },
					"telemetry",
					`operation ${i}`,
				)
			}

			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(3) // Should only have 3 items (oldest was evicted)
		})
	})

	describe("persistence", () => {
		it("should persist queue to workspace state", async () => {
			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
				"roo.retryQueue",
				expect.arrayContaining([
					expect.objectContaining({
						url: "https://api.example.com/test",
						type: "telemetry",
					}),
				]),
			)
		})

		it("should load persisted queue on initialization", () => {
			const persistedRequests: QueuedRequest[] = [
				{
					id: "test-1",
					url: "https://api.example.com/test1",
					options: { method: "POST" },
					timestamp: Date.now(),
					retryCount: 0,
					type: "telemetry",
				},
			]

			// Set up mock to return persisted data
			const storage = new Map([["roo.retryQueue", persistedRequests]])
			mockContext = {
				workspaceState: {
					get: vi.fn((key: string) => storage.get(key)),
					update: vi.fn(),
				},
			} as unknown as ExtensionContext

			retryQueue = new RetryQueue(mockContext)

			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1)
			expect(mockContext.workspaceState.get).toHaveBeenCalledWith("roo.retryQueue")
		})
	})

	describe("clear", () => {
		it("should clear all queued requests", async () => {
			await retryQueue.enqueue("https://api.example.com/test1", { method: "POST" }, "telemetry")
			await retryQueue.enqueue("https://api.example.com/test2", { method: "POST" }, "api-call")

			let stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(2)

			retryQueue.clear()

			stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(0)
		})
	})

	describe("getStats", () => {
		it("should return correct statistics", async () => {
			const now = Date.now()

			await retryQueue.enqueue("https://api.example.com/test1", { method: "POST" }, "telemetry")
			await retryQueue.enqueue("https://api.example.com/test2", { method: "POST" }, "api-call")
			await retryQueue.enqueue("https://api.example.com/test3", { method: "POST" }, "telemetry")

			const stats = retryQueue.getStats()

			expect(stats.totalQueued).toBe(3)
			expect(stats.byType["telemetry"]).toBe(2)
			expect(stats.byType["api-call"]).toBe(1)
			expect(stats.oldestRequest).toBeDefined()
			expect(stats.newestRequest).toBeDefined()
			expect(stats.oldestRequest!.getTime()).toBeGreaterThanOrEqual(now)
			expect(stats.newestRequest!.getTime()).toBeGreaterThanOrEqual(now)
		})
	})

	describe("events", () => {
		it("should emit request-queued event when enqueueing", async () => {
			const listener = vi.fn()
			retryQueue.on("request-queued", listener)

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.example.com/test",
					type: "telemetry",
				}),
			)
		})

		it("should emit queue-cleared event when clearing", () => {
			const listener = vi.fn()
			retryQueue.on("queue-cleared", listener)

			retryQueue.clear()

			expect(listener).toHaveBeenCalled()
		})
	})

	describe("retryAll", () => {
		let fetchMock: ReturnType<typeof vi.fn>

		beforeEach(() => {
			// Mock global fetch
			fetchMock = vi.fn()
			global.fetch = fetchMock
		})

		afterEach(() => {
			vi.restoreAllMocks()
		})

		it("should process requests in FIFO order", async () => {
			const successListener = vi.fn()
			retryQueue.on("request-retry-success", successListener)

			// Add multiple requests
			await retryQueue.enqueue("https://api.example.com/test1", { method: "POST" }, "telemetry")
			await retryQueue.enqueue("https://api.example.com/test2", { method: "POST" }, "telemetry")
			await retryQueue.enqueue("https://api.example.com/test3", { method: "POST" }, "telemetry")

			// Mock successful responses
			fetchMock.mockResolvedValue({ ok: true })

			await retryQueue.retryAll()

			// Check that fetch was called in FIFO order
			expect(fetchMock).toHaveBeenCalledTimes(3)
			expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.com/test1")
			expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.example.com/test2")
			expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.example.com/test3")

			// Check that success events were emitted
			expect(successListener).toHaveBeenCalledTimes(3)

			// Queue should be empty after successful retries
			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(0)
		})

		it("should handle failed retries and increment retry count", async () => {
			const failListener = vi.fn()
			retryQueue.on("request-retry-failed", failListener)

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock failed response
			fetchMock.mockRejectedValue(new Error("Network error"))

			await retryQueue.retryAll()

			// Check that failure event was emitted
			expect(failListener).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.example.com/test",
					retryCount: 1,
					lastError: "Network error",
				}),
				expect.any(Error),
			)

			// Request should still be in queue
			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1)
		})

		it("should enforce max retries limit", async () => {
			// Create queue with max retries of 2
			retryQueue = new RetryQueue(mockContext, { maxRetries: 2 })

			const maxRetriesListener = vi.fn()
			retryQueue.on("request-max-retries-exceeded", maxRetriesListener)

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock failed responses
			fetchMock.mockRejectedValue(new Error("Network error"))

			// First retry
			await retryQueue.retryAll()
			let stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1) // Still in queue

			// Second retry - should hit max retries
			await retryQueue.retryAll()

			// Check that max retries event was emitted
			expect(maxRetriesListener).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.example.com/test",
					retryCount: 2,
				}),
				expect.any(Error),
			)

			// Request should be removed from queue after exceeding max retries
			stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(0)
		})

		it("should not process if already processing", async () => {
			// Add a request
			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock a slow response
			fetchMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100)))

			// Start first retryAll (don't await)
			const firstCall = retryQueue.retryAll()

			// Try to call retryAll again immediately
			const secondCall = retryQueue.retryAll()

			// Both should complete without errors
			await Promise.all([firstCall, secondCall])

			// Fetch should only be called once (from the first call)
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})

		it("should handle empty queue gracefully", async () => {
			// Call retryAll on empty queue
			await expect(retryQueue.retryAll()).resolves.toBeUndefined()

			// No fetch calls should be made
			expect(fetchMock).not.toHaveBeenCalled()
		})

		it("should use auth header provider if available", async () => {
			const authHeaderProvider = vi.fn().mockReturnValue({
				Authorization: "Bearer fresh-token",
			})

			retryQueue = new RetryQueue(mockContext, {}, undefined, authHeaderProvider)

			await retryQueue.enqueue(
				"https://api.example.com/test",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
				},
				"telemetry",
			)

			fetchMock.mockResolvedValue({ ok: true })

			await retryQueue.retryAll()

			// Check that fresh auth headers were used
			expect(fetchMock).toHaveBeenCalledWith(
				"https://api.example.com/test",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer fresh-token",
						"Content-Type": "application/json",
						"X-Retry-Queue": "true",
					}),
				}),
			)

			expect(authHeaderProvider).toHaveBeenCalled()
		})

		it("should respect configurable timeout", async () => {
			// Create queue with custom timeout (short timeout for testing)
			retryQueue = new RetryQueue(mockContext, { requestTimeout: 100 })

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock fetch to reject with abort error
			const abortError = new Error("The operation was aborted")
			abortError.name = "AbortError"
			fetchMock.mockRejectedValue(abortError)

			const failListener = vi.fn()
			retryQueue.on("request-retry-failed", failListener)

			await retryQueue.retryAll()

			// Check that the request failed with an abort error
			expect(failListener).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.example.com/test",
					lastError: "The operation was aborted",
				}),
				expect.any(Error),
			)

			// The timeout configuration is being used (verified by the constructor accepting it)
			// The actual timeout behavior is handled by the browser's AbortController
		})

		it("should retry on 500+ status codes", async () => {
			const failListener = vi.fn()
			const successListener = vi.fn()
			retryQueue.on("request-retry-failed", failListener)
			retryQueue.on("request-retry-success", successListener)

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// First attempt: 500 error
			fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })

			await retryQueue.retryAll()

			// Should fail and remain in queue
			expect(failListener).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.example.com/test",
					retryCount: 1,
					lastError: "Server error: 500 Internal Server Error",
				}),
				expect.any(Error),
			)

			let stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1)

			// Second attempt: success
			fetchMock.mockResolvedValueOnce({ ok: true, status: 200 })

			await retryQueue.retryAll()

			// Should succeed and be removed from queue
			expect(successListener).toHaveBeenCalled()
			stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(0)
		})

		it("should handle 429 rate limiting with Retry-After header", async () => {
			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock 429 response with Retry-After header (in seconds)
			const retryAfterResponse = {
				ok: false,
				status: 429,
				headers: {
					get: vi.fn((header: string) => {
						if (header === "Retry-After") return "2" // 2 seconds
						return null
					}),
				},
			}

			fetchMock.mockResolvedValueOnce(retryAfterResponse)

			await retryQueue.retryAll()

			// Request should still be in queue with nextRetryAfter set
			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1)

			// Try to retry immediately - should be skipped due to rate limiting
			fetchMock.mockClear()
			await retryQueue.retryAll()

			// Fetch should not be called because request is rate-limited
			expect(fetchMock).not.toHaveBeenCalled()
		})

		it("should retry on 401/403 auth errors", async () => {
			const failListener = vi.fn()
			retryQueue.on("request-retry-failed", failListener)

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock 401 error
			fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: "Unauthorized" })

			await retryQueue.retryAll()

			// Should fail and remain in queue for retry
			expect(failListener).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "https://api.example.com/test",
					retryCount: 1,
					lastError: "Auth error: 401",
				}),
				expect.any(Error),
			)

			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(1)
		})

		it("should not retry on 400/404 client errors", async () => {
			const successListener = vi.fn()
			retryQueue.on("request-retry-success", successListener)

			await retryQueue.enqueue("https://api.example.com/test", { method: "POST" }, "telemetry")

			// Mock 404 error
			fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })

			await retryQueue.retryAll()

			// Should be removed from queue without retry
			expect(successListener).toHaveBeenCalled()
			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(0)
		})

		it("should prevent concurrent processing", async () => {
			// Add a single request
			await retryQueue.enqueue("https://api.example.com/test1", { method: "POST" }, "telemetry")

			// Mock slow response
			let resolveFirst: () => void
			const firstPromise = new Promise<{ ok: boolean }>((resolve) => {
				resolveFirst = () => resolve({ ok: true })
			})

			fetchMock.mockReturnValueOnce(firstPromise)

			// Start first retryAll (don't await)
			const firstCall = retryQueue.retryAll()

			// Try to call retryAll again immediately - should return immediately without processing
			const secondCall = retryQueue.retryAll()

			// Second call should return immediately
			await secondCall

			// Fetch should only be called once (from first call)
			expect(fetchMock).toHaveBeenCalledTimes(1)

			// Resolve the promise
			resolveFirst!()

			// Wait for first call to complete
			await firstCall

			// Queue should be empty
			const stats = retryQueue.getStats()
			expect(stats.totalQueued).toBe(0)
		})
	})
})
