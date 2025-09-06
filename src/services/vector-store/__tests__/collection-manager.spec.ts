import { CollectionManager } from "../collection-manager"

describe("CollectionManager", () => {
	/**
	 * Since the readyCollections and inFlightEnsures maps are module-scoped,
	 * we can't easily reset them between tests. Instead, we'll use unique
	 * collection names for each test to avoid interference.
	 */
	let testCounter = 0

	beforeEach(() => {
		testCounter++
	})

	const getTestCollectionName = (suffix = "") => `test-collection-${testCounter}${suffix ? `-${suffix}` : ""}`

	describe("key generation", () => {
		it("should generate consistent keys for same name and dimension", () => {
			const collectionName = getTestCollectionName()
			const key1 = CollectionManager.key(collectionName, 1536)
			const key2 = CollectionManager.key(collectionName, 1536)

			expect(key1).toBe(key2)
			expect(key1).toBe(`${collectionName}:1536`)
		})

		it("should generate different keys for different names", () => {
			const collectionA = getTestCollectionName("a")
			const collectionB = getTestCollectionName("b")
			const key1 = CollectionManager.key(collectionA, 1536)
			const key2 = CollectionManager.key(collectionB, 1536)

			expect(key1).not.toBe(key2)
			expect(key1).toBe(`${collectionA}:1536`)
			expect(key2).toBe(`${collectionB}:1536`)
		})

		it("should generate different keys for different dimensions", () => {
			const collectionName = getTestCollectionName()
			const key1 = CollectionManager.key(collectionName, 1536)
			const key2 = CollectionManager.key(collectionName, 768)

			expect(key1).not.toBe(key2)
			expect(key1).toBe(`${collectionName}:1536`)
			expect(key2).toBe(`${collectionName}:768`)
		})
	})

	describe("readiness tracking", () => {
		it("should return false for unknown collections", () => {
			const unknownCollection = getTestCollectionName("unknown")
			expect(CollectionManager.isReady(unknownCollection, 1536)).toBe(false)
		})

		it("should return true after marking as ready", () => {
			const collectionName = getTestCollectionName()
			CollectionManager.markReady(collectionName, 1536)
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
		})

		it("should persist ready state across multiple checks", () => {
			const collectionName = getTestCollectionName()
			CollectionManager.markReady(collectionName, 1536)

			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
		})

		it("should track readiness per unique key", () => {
			const collectionA = getTestCollectionName("a")
			const collectionB = getTestCollectionName("b")
			CollectionManager.markReady(collectionA, 1536)
			CollectionManager.markReady(collectionB, 768)

			expect(CollectionManager.isReady(collectionA, 1536)).toBe(true)
			expect(CollectionManager.isReady(collectionB, 768)).toBe(true)
			expect(CollectionManager.isReady(collectionA, 768)).toBe(false)
			expect(CollectionManager.isReady(collectionB, 1536)).toBe(false)
		})
	})

	describe("ensureOnce basic behavior", () => {
		it("should call ensure function for new collection", async () => {
			const ensureFn = vi.fn().mockResolvedValue(true)
			const collectionName = getTestCollectionName()

			const result = await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			expect(ensureFn).toHaveBeenCalledWith(collectionName, 1536)
			expect(ensureFn).toHaveBeenCalledTimes(1)
			expect(result).toBe(true)
		})

		it("should mark collection as ready after successful ensure", async () => {
			const ensureFn = vi.fn().mockResolvedValue(true)
			const collectionName = getTestCollectionName()

			expect(CollectionManager.isReady(collectionName, 1536)).toBe(false)

			await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
		})

		it("should return false for already ready collections without calling ensure function", async () => {
			const ensureFn = vi.fn().mockResolvedValue(true)
			const collectionName = getTestCollectionName()

			// Mark as ready first
			CollectionManager.markReady(collectionName, 1536)

			const result = await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			expect(ensureFn).not.toHaveBeenCalled()
			expect(result).toBe(false)
		})
	})

	describe("ensure-once behavior", () => {
		it("should call ensure function only once for multiple sequential calls", async () => {
			const ensureFn = vi.fn().mockResolvedValue(true)
			const collectionName = getTestCollectionName()

			const result1 = await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)
			const result2 = await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)
			const result3 = await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			expect(ensureFn).toHaveBeenCalledTimes(1)
			expect(result1).toBe(true) // First call returns ensure function result
			expect(result2).toBe(false) // Subsequent calls return false
			expect(result3).toBe(false)
		})

		it("should handle different collections independently", async () => {
			const ensureFn = vi.fn().mockResolvedValue(true)
			const collectionA = getTestCollectionName("a")
			const collectionB = getTestCollectionName("b")

			const result1 = await CollectionManager.ensureOnce(ensureFn, collectionA, 1536)
			const result2 = await CollectionManager.ensureOnce(ensureFn, collectionB, 1536)
			const result3 = await CollectionManager.ensureOnce(ensureFn, collectionA, 768)

			expect(ensureFn).toHaveBeenCalledTimes(3)
			expect(ensureFn).toHaveBeenNthCalledWith(1, collectionA, 1536)
			expect(ensureFn).toHaveBeenNthCalledWith(2, collectionB, 1536)
			expect(ensureFn).toHaveBeenNthCalledWith(3, collectionA, 768)

			expect(result1).toBe(true)
			expect(result2).toBe(true)
			expect(result3).toBe(true)
		})
	})

	describe("concurrent access deduplication", () => {
		/**
		 * Tests that multiple concurrent calls to ensureOnce for the same key
		 * are properly deduplicated and only result in a single ensure function call.
		 */
		it("should deduplicate concurrent ensure calls for same key", async () => {
			let resolveEnsure: (value: boolean) => void
			const ensurePromise = new Promise<boolean>((resolve) => {
				resolveEnsure = resolve
			})

			const ensureFn = vi.fn().mockReturnValue(ensurePromise)
			const collectionName = getTestCollectionName()

			// Start multiple concurrent calls
			const promise1 = CollectionManager.ensureOnce(ensureFn, collectionName, 1536)
			const promise2 = CollectionManager.ensureOnce(ensureFn, collectionName, 1536)
			const promise3 = CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			// Ensure function should only be called once
			expect(ensureFn).toHaveBeenCalledTimes(1)

			// Resolve the ensure function
			resolveEnsure!(true)

			// All promises should resolve to the same value
			const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

			expect(result1).toBe(true)
			expect(result2).toBe(true)
			expect(result3).toBe(true)

			// Collection should be marked as ready
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
		})

		it("should handle concurrent calls for different keys independently", async () => {
			let resolveEnsure1: (value: boolean) => void
			let resolveEnsure2: (value: boolean) => void

			const ensurePromise1 = new Promise<boolean>((resolve) => {
				resolveEnsure1 = resolve
			})
			const ensurePromise2 = new Promise<boolean>((resolve) => {
				resolveEnsure2 = resolve
			})

			const ensureFn = vi.fn().mockReturnValueOnce(ensurePromise1).mockReturnValueOnce(ensurePromise2)

			const collectionA = getTestCollectionName("a")
			const collectionB = getTestCollectionName("b")

			// Start concurrent calls for different keys
			const promise1 = CollectionManager.ensureOnce(ensureFn, collectionA, 1536)
			const promise2 = CollectionManager.ensureOnce(ensureFn, collectionB, 1536)

			expect(ensureFn).toHaveBeenCalledTimes(2)
			expect(ensureFn).toHaveBeenNthCalledWith(1, collectionA, 1536)
			expect(ensureFn).toHaveBeenNthCalledWith(2, collectionB, 1536)

			// Resolve both promises
			resolveEnsure1!(true)
			resolveEnsure2!(false)

			const [result1, result2] = await Promise.all([promise1, promise2])

			expect(result1).toBe(true)
			expect(result2).toBe(false)
		})
	})

	describe("error handling", () => {
		it("should not mark collection as ready if ensure function throws", async () => {
			const error = new Error("Ensure failed")
			const ensureFn = vi.fn().mockRejectedValue(error)
			const collectionName = getTestCollectionName()

			await expect(CollectionManager.ensureOnce(ensureFn, collectionName, 1536)).rejects.toThrow("Ensure failed")

			expect(CollectionManager.isReady(collectionName, 1536)).toBe(false)
		})

		it("should allow retry after failed ensure", async () => {
			const error = new Error("Ensure failed")
			const ensureFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(true)

			const collectionName = getTestCollectionName()

			// First call should fail
			await expect(CollectionManager.ensureOnce(ensureFn, collectionName, 1536)).rejects.toThrow("Ensure failed")

			expect(CollectionManager.isReady(collectionName, 1536)).toBe(false)

			// Second call should succeed
			const result = await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			expect(ensureFn).toHaveBeenCalledTimes(2)
			expect(result).toBe(true)
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
		})

		/**
		 * Tests that when concurrent calls are in-flight and the ensure function fails,
		 * all concurrent calls receive the same error and cleanup happens properly.
		 */
		it("should handle errors in concurrent calls properly", async () => {
			const error = new Error("Concurrent ensure failed")
			let rejectEnsure: (error: Error) => void

			const ensurePromise = new Promise<boolean>((_, reject) => {
				rejectEnsure = reject
			})

			const ensureFn = vi.fn().mockReturnValue(ensurePromise)
			const collectionName = getTestCollectionName()

			// Start multiple concurrent calls
			const promise1 = CollectionManager.ensureOnce(ensureFn, collectionName, 1536)
			const promise2 = CollectionManager.ensureOnce(ensureFn, collectionName, 1536)
			const promise3 = CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			expect(ensureFn).toHaveBeenCalledTimes(1)

			// Reject the ensure function
			rejectEnsure!(error)

			// All promises should reject with the same error
			await expect(promise1).rejects.toThrow("Concurrent ensure failed")
			await expect(promise2).rejects.toThrow("Concurrent ensure failed")
			await expect(promise3).rejects.toThrow("Concurrent ensure failed")

			// Collection should not be marked as ready
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(false)

			// Should be able to retry after cleanup
			const retryEnsureFn = vi.fn().mockResolvedValue(true)
			const retryResult = await CollectionManager.ensureOnce(retryEnsureFn, collectionName, 1536)

			expect(retryEnsureFn).toHaveBeenCalledTimes(1)
			expect(retryResult).toBe(true)
			expect(CollectionManager.isReady(collectionName, 1536)).toBe(true)
		})
	})

	describe("cleanup verification", () => {
		/**
		 * Tests that the in-flight tracking map is properly cleaned up after
		 * ensure operations complete, preventing memory leaks.
		 */
		it("should clean up in-flight tracking after successful completion", async () => {
			const ensureFn = vi.fn().mockResolvedValue(true)
			const collectionName = getTestCollectionName()

			await CollectionManager.ensureOnce(ensureFn, collectionName, 1536)

			// After completion, subsequent calls should go through normal ready check
			// rather than finding an in-flight operation
			const ensureFn2 = vi.fn().mockResolvedValue(false)
			const result = await CollectionManager.ensureOnce(ensureFn2, collectionName, 1536)

			expect(ensureFn2).not.toHaveBeenCalled()
			expect(result).toBe(false) // Should return false because already ready
		})

		it("should clean up in-flight tracking after error", async () => {
			const error = new Error("Cleanup test error")
			const ensureFn = vi.fn().mockRejectedValue(error)
			const collectionName = getTestCollectionName()

			await expect(CollectionManager.ensureOnce(ensureFn, collectionName, 1536)).rejects.toThrow(
				"Cleanup test error",
			)

			// After error, should be able to retry (not find stale in-flight operation)
			const retryEnsureFn = vi.fn().mockResolvedValue(true)
			const result = await CollectionManager.ensureOnce(retryEnsureFn, collectionName, 1536)

			expect(retryEnsureFn).toHaveBeenCalledTimes(1)
			expect(result).toBe(true)
		})
	})
})
