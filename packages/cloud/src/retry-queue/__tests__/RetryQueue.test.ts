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
})
