import { describe, test, expect, vi } from "vitest"
import { createAsyncQueue } from "../asyncQueue"

describe("AsyncQueue", () => {
	describe("error handling race condition", () => {
		test("should throw error even if it occurs after limit is reached", async () => {
			const limit = 5
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue items up to the limit
			for (let i = 0; i < limit; i++) {
				await queue.enqueue(`item-${i}`)
			}

			const results: string[] = []
			let caughtError: Error | null = null

			try {
				for await (const item of queue) {
					results.push(item)
					// Simulate an error occurring after we've consumed all items
					if (results.length === limit) {
						// This error should still be thrown even though limit is reached
						queue.error(new Error("Error after limit reached"))
					}
				}
			} catch (error) {
				caughtError = error as Error
			}

			// Should have received all items
			expect(results).toHaveLength(limit)
			// Should have caught the error
			expect(caughtError).toBeTruthy()
			expect(caughtError?.message).toBe("Error after limit reached")
		})

		test("should throw error when error is called before limit is reached", async () => {
			const limit = 10
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue some items
			for (let i = 0; i < 5; i++) {
				await queue.enqueue(`item-${i}`)
			}

			// Call error before limit is reached
			queue.error(new Error("Error before limit"))

			const results: string[] = []
			let caughtError: Error | null = null

			try {
				for await (const item of queue) {
					results.push(item)
				}
			} catch (error) {
				caughtError = error as Error
			}

			// Should have received some items before the error
			expect(results.length).toBeGreaterThan(0)
			// Should have caught the error
			expect(caughtError).toBeTruthy()
			expect(caughtError?.message).toBe("Error before limit")
		})

		test("should throw error when error is called after all items are consumed", async () => {
			const limit = 3
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue items up to the limit
			for (let i = 0; i < limit; i++) {
				await queue.enqueue(`item-${i}`)
			}

			// Mark as complete
			queue.complete()

			// Call error after completion (should still be stored)
			queue.error(new Error("Error after completion"))

			const results: string[] = []
			let caughtError: Error | null = null

			try {
				for await (const item of queue) {
					results.push(item)
				}
			} catch (error) {
				caughtError = error as Error
			}

			// Should have received all items
			expect(results).toHaveLength(limit)
			// Should have caught the error
			expect(caughtError).toBeTruthy()
			expect(caughtError?.message).toBe("Error after completion")
		})

		test("should handle error called during iteration before limit is reached", async () => {
			const limit = 10
			const queue = createAsyncQueue<string>({ limit })

			const results: string[] = []
			let caughtError: Error | null = null

			// Start consuming in parallel
			const consumer = (async () => {
				try {
					for await (const item of queue) {
						results.push(item)
						// Trigger error after consuming 3 items
						if (results.length === 3) {
							queue.error(new Error("Error during iteration"))
						}
					}
				} catch (error) {
					caughtError = error instanceof Error ? error : new Error(String(error))
				}
			})()

			// Enqueue items
			for (let i = 0; i < 5; i++) {
				await queue.enqueue(`item-${i}`)
			}

			await consumer

			// Should have received some items before the error
			expect(results.length).toBeGreaterThan(0)
			expect(results.length).toBeLessThan(limit)
			// Should have caught the error
			expect(caughtError).toBeTruthy()
			expect((caughtError as unknown as Error)?.message).toBe("Error during iteration")
		})
	})

	describe("basic functionality", () => {
		test("should yield all enqueued items", async () => {
			const queue = createAsyncQueue<string>()
			const items = ["item1", "item2", "item3"]

			for (const item of items) {
				await queue.enqueue(item)
			}
			queue.complete()

			const results: string[] = []
			for await (const item of queue) {
				results.push(item)
			}

			expect(results).toEqual(items)
		})

		test("should yield all items regardless of limit when complete is called", async () => {
			const limit = 3
			const queue = createAsyncQueue<string>({ limit })

			// Start consuming in parallel to allow enqueues to complete
			const results: string[] = []
			const consumer = (async () => {
				for await (const item of queue) {
					results.push(item)
				}
			})()

			// Enqueue more items than the limit
			for (let i = 0; i < 10; i++) {
				await queue.enqueue(`item-${i}`)
			}
			queue.complete()

			// Wait for consumer to finish
			await consumer

			// Should yield all items, not just the limit
			expect(results).toHaveLength(10)
			expect(results).toEqual([
				"item-0",
				"item-1",
				"item-2",
				"item-3",
				"item-4",
				"item-5",
				"item-6",
				"item-7",
				"item-8",
				"item-9",
			])
		})

		test("should handle empty queue", async () => {
			const queue = createAsyncQueue<string>()
			queue.complete()

			const results: string[] = []
			for await (const item of queue) {
				results.push(item)
			}

			expect(results).toEqual([])
		})

		test("should handle items enqueued after iteration starts", async () => {
			const queue = createAsyncQueue<string>()

			const results: string[] = []

			// Start consuming in parallel
			const consumer = (async () => {
				for await (const item of queue) {
					results.push(item)
				}
			})()

			// Enqueue items after starting consumption
			setTimeout(() => queue.enqueue("item1"), 10)
			setTimeout(() => queue.enqueue("item2"), 20)
			setTimeout(() => queue.complete(), 30)

			await consumer

			expect(results).toEqual(["item1", "item2"])
		})
	})

	describe("concurrency limit behavior", () => {
		test("should wait when enqueue is called and queue is at capacity", async () => {
			const limit = 2
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue items up to the limit
			await queue.enqueue("item-0")
			await queue.enqueue("item-1")

			// This enqueue should wait since queue is at capacity
			const enqueuePromise = queue.enqueue("item-2")

			// Verify enqueue hasn't completed yet
			let isPending = true
			enqueuePromise.then(() => {
				isPending = false
			})

			// Wait a bit to confirm it's still pending
			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(isPending).toBe(true)

			// Start consuming to free up space
			const results: string[] = []
			const consumer = (async () => {
				for await (const item of queue) {
					results.push(item)
				}
			})()

			// Wait for the pending enqueue to complete
			await enqueuePromise

			// Now complete the queue and wait for consumer
			queue.complete()
			await consumer

			// Should have received all items
			expect(results).toEqual(["item-0", "item-1", "item-2"])
		})

		test("should handle multiple concurrent enqueue calls waiting for space", async () => {
			const limit = 2
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue items up to the limit
			await queue.enqueue("item-0")
			await queue.enqueue("item-1")

			// Start multiple concurrent enqueues that should wait
			const enqueuePromises = [queue.enqueue("item-2"), queue.enqueue("item-3"), queue.enqueue("item-4")]

			// Start consuming to free up space
			const results: string[] = []
			const consumer = (async () => {
				for await (const item of queue) {
					results.push(item)
				}
			})()

			// Wait for all enqueues to complete
			await Promise.all(enqueuePromises)

			// Complete the queue and wait for consumer
			queue.complete()
			await consumer

			// Should have received all items in order
			expect(results).toEqual(["item-0", "item-1", "item-2", "item-3", "item-4"])
		})

		test("should wake up waiting enqueue calls when items are dequeued", async () => {
			const limit = 1
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue one item to reach capacity
			await queue.enqueue("item-0")

			// Start an enqueue that should wait
			const enqueuePromise = queue.enqueue("item-1")

			// Start consuming to free up space
			const results: string[] = []
			const consumer = (async () => {
				for await (const item of queue) {
					results.push(item)
				}
			})()

			// Wait for the pending enqueue to complete
			await enqueuePromise

			// Complete the queue and wait for consumer
			queue.complete()
			await consumer

			// Should have received both items
			expect(results).toEqual(["item-0", "item-1"])
		})

		test("should allow enqueue to complete when complete() is called while waiting", async () => {
			const limit = 1
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue one item to reach capacity
			await queue.enqueue("item-0")

			// Start an enqueue that should wait
			const enqueuePromise = queue.enqueue("item-1")

			// Complete the queue (should wake up waiting enqueues)
			queue.complete()

			// Wait for the pending enqueue to complete (should resolve gracefully without adding item)
			await enqueuePromise

			// Consume remaining items
			const results: string[] = []
			for await (const item of queue) {
				results.push(item)
			}

			// Should have received only the first item since enqueue was aborted by complete()
			expect(results).toEqual(["item-0"])
		})

		test("should allow enqueue to complete when error() is called while waiting", async () => {
			const limit = 1
			const queue = createAsyncQueue<string>({ limit })

			// Enqueue one item to reach capacity
			await queue.enqueue("item-0")

			// Start an enqueue that should wait
			const enqueuePromise = queue.enqueue("item-1")

			// Call error (should wake up waiting enqueues)
			queue.error(new Error("Test error"))

			// Wait for the pending enqueue to complete (should resolve gracefully)
			await enqueuePromise

			// Consume items and catch error
			const results: string[] = []
			let caughtError: Error | null = null

			try {
				for await (const item of queue) {
					results.push(item)
				}
			} catch (error) {
				caughtError = error as Error
			}

			// Should have received the first item
			expect(results).toEqual(["item-0"])
			// Should have caught the error
			expect(caughtError?.message).toBe("Test error")
		})
	})

	describe("error handling", () => {
		test("should throw error when error is called", async () => {
			const queue = createAsyncQueue<string>()
			const testError = new Error("Test error")

			await queue.enqueue("item1")
			queue.error(testError)

			const results: string[] = []
			let caughtError: Error | null = null

			try {
				for await (const item of queue) {
					results.push(item)
				}
			} catch (error) {
				caughtError = error as Error
			}

			expect(results).toEqual(["item1"])
			expect(caughtError).toBe(testError)
		})

		test("should not enqueue items after error is called", async () => {
			const queue = createAsyncQueue<string>()

			await queue.enqueue("item1")
			queue.error(new Error("Test error"))
			await queue.enqueue("item2") // This should be ignored

			const results: string[] = []
			let caughtError: Error | null = null

			try {
				for await (const item of queue) {
					results.push(item)
				}
			} catch (error) {
				caughtError = error as Error
			}

			expect(results).toEqual(["item1"])
			expect(caughtError?.message).toBe("Test error")
		})
	})

	describe("timeout", () => {
		test("should reset timeout when item is enqueued", async () => {
			const timeout = 100
			const onTimeout = vi.fn()
			const queue = createAsyncQueue<string>({ timeout, onTimeout })

			// Start consuming
			const consumer = (async () => {
				for await (const item of queue) {
					// Consume items
				}
			})()

			// Enqueue an item before timeout
			setTimeout(() => queue.enqueue("item1"), 50)
			setTimeout(() => queue.enqueue("item2"), 100)
			setTimeout(() => queue.enqueue("item3"), 150)

			// Wait longer than timeout but less than total time with resets
			await new Promise((resolve) => setTimeout(resolve, timeout + 50))

			// Timeout should not have been called because we reset it
			expect(onTimeout).not.toHaveBeenCalled()

			// Clean up
			queue.complete()
			await consumer
		}, 10000)
	})
})
