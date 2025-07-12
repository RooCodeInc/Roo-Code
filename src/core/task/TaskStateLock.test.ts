import { describe, test, expect, afterEach } from "vitest"
import { TaskStateLock } from "./TaskStateLock"

describe("TaskStateLock", () => {
	afterEach(() => {
		TaskStateLock.clearAllLocks()
	})

	test("acquire and release lock", async () => {
		const lockKey = "test-lock"

		// Acquire lock
		const release = await TaskStateLock.acquire(lockKey)
		expect(TaskStateLock.isLocked(lockKey)).toBe(true)

		// Release lock
		release()
		expect(TaskStateLock.isLocked(lockKey)).toBe(false)
	})

	test("tryAcquire returns null when lock is held", async () => {
		const lockKey = "test-lock"

		// Acquire lock
		const release = await TaskStateLock.acquire(lockKey)

		// Try to acquire the same lock should fail
		const tryResult = TaskStateLock.tryAcquire(lockKey)
		expect(tryResult).toBeNull()

		// Release and try again should succeed
		release()
		const tryResult2 = TaskStateLock.tryAcquire(lockKey)
		expect(tryResult2).not.toBeNull()

		if (tryResult2) {
			tryResult2()
		}
	})

	test("withLock executes function with exclusive access", async () => {
		const lockKey = "test-lock"
		let counter = 0

		// Start two concurrent operations
		const promise1 = TaskStateLock.withLock(lockKey, async () => {
			const initialValue = counter
			await new Promise((resolve) => setTimeout(resolve, 10))
			counter = initialValue + 1
			return "result1"
		})

		const promise2 = TaskStateLock.withLock(lockKey, async () => {
			const initialValue = counter
			await new Promise((resolve) => setTimeout(resolve, 10))
			counter = initialValue + 1
			return "result2"
		})

		const [result1, result2] = await Promise.all([promise1, promise2])

		// Both operations should complete but counter should be 2 (not corrupted)
		expect(counter).toBe(2)
		expect([result1, result2]).toEqual(["result1", "result2"])
	})

	test("multiple different locks can be held simultaneously", async () => {
		const lock1 = "lock-1"
		const lock2 = "lock-2"

		const release1 = await TaskStateLock.acquire(lock1)
		const release2 = await TaskStateLock.acquire(lock2)

		expect(TaskStateLock.isLocked(lock1)).toBe(true)
		expect(TaskStateLock.isLocked(lock2)).toBe(true)

		release1()
		release2()

		expect(TaskStateLock.isLocked(lock1)).toBe(false)
		expect(TaskStateLock.isLocked(lock2)).toBe(false)
	})

	test("clearAllLocks clears all active locks", async () => {
		const lock1 = "lock-1"
		const lock2 = "lock-2"

		await TaskStateLock.acquire(lock1)
		await TaskStateLock.acquire(lock2)

		expect(TaskStateLock.isLocked(lock1)).toBe(true)
		expect(TaskStateLock.isLocked(lock2)).toBe(true)

		TaskStateLock.clearAllLocks()

		expect(TaskStateLock.isLocked(lock1)).toBe(false)
		expect(TaskStateLock.isLocked(lock2)).toBe(false)
	})
})
