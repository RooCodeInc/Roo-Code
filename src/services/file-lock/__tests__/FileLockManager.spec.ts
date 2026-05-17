import path from "path"
import { FileLockManager, type FileLockEvent } from "../FileLockManager"

describe("FileLockManager", () => {
	let manager: FileLockManager

	beforeEach(() => {
		manager = new FileLockManager()
	})

	afterEach(() => {
		manager.dispose()
	})

	describe("acquireLock", () => {
		it("should acquire a lock on an unlocked file", () => {
			const result = manager.acquireLock("/project/foo.ts", "task-1")
			expect(result).toBe(true)
			expect(manager.getLockHolder("/project/foo.ts")).toBe("task-1")
		})

		it("should allow the same task to re-acquire a lock (re-entrant)", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			const result = manager.acquireLock("/project/foo.ts", "task-1")
			expect(result).toBe(true)
			expect(manager.getLockHolder("/project/foo.ts")).toBe("task-1")
		})

		it("should deny a lock when another task holds it", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			const result = manager.acquireLock("/project/foo.ts", "task-2")
			expect(result).toBe(false)
			expect(manager.getLockHolder("/project/foo.ts")).toBe("task-1")
		})

		it("should normalize paths so equivalent paths resolve to the same lock", () => {
			manager.acquireLock("/project/src/../foo.ts", "task-1")
			const result = manager.acquireLock("/project/foo.ts", "task-2")
			expect(result).toBe(false)
		})

		it("should allow locking multiple different files by the same task", () => {
			expect(manager.acquireLock("/project/a.ts", "task-1")).toBe(true)
			expect(manager.acquireLock("/project/b.ts", "task-1")).toBe(true)
			expect(manager.getLockedFiles("task-1")).toHaveLength(2)
		})

		it("should allow different tasks to lock different files", () => {
			expect(manager.acquireLock("/project/a.ts", "task-1")).toBe(true)
			expect(manager.acquireLock("/project/b.ts", "task-2")).toBe(true)
			expect(manager.getLockHolder("/project/a.ts")).toBe("task-1")
			expect(manager.getLockHolder("/project/b.ts")).toBe("task-2")
		})
	})

	describe("releaseLock", () => {
		it("should release a lock held by the specified task", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			manager.releaseLock("/project/foo.ts", "task-1")
			expect(manager.getLockHolder("/project/foo.ts")).toBeUndefined()
		})

		it("should be a no-op when the task does not hold the lock", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			manager.releaseLock("/project/foo.ts", "task-2")
			expect(manager.getLockHolder("/project/foo.ts")).toBe("task-1")
		})

		it("should be a no-op when the file is not locked", () => {
			// Should not throw
			manager.releaseLock("/project/foo.ts", "task-1")
		})

		it("should allow another task to acquire the lock after release", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			manager.releaseLock("/project/foo.ts", "task-1")
			expect(manager.acquireLock("/project/foo.ts", "task-2")).toBe(true)
		})

		it("should clean up taskLocks when the last lock for a task is released", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			manager.releaseLock("/project/foo.ts", "task-1")
			expect(manager.getLockedFiles("task-1")).toHaveLength(0)
		})
	})

	describe("releaseAllLocks", () => {
		it("should release all locks for a task", () => {
			manager.acquireLock("/project/a.ts", "task-1")
			manager.acquireLock("/project/b.ts", "task-1")
			manager.acquireLock("/project/c.ts", "task-1")
			manager.releaseAllLocks("task-1")

			expect(manager.getLockedFiles("task-1")).toHaveLength(0)
			expect(manager.getLockHolder("/project/a.ts")).toBeUndefined()
			expect(manager.getLockHolder("/project/b.ts")).toBeUndefined()
			expect(manager.getLockHolder("/project/c.ts")).toBeUndefined()
		})

		it("should not affect locks held by other tasks", () => {
			manager.acquireLock("/project/a.ts", "task-1")
			manager.acquireLock("/project/b.ts", "task-2")
			manager.releaseAllLocks("task-1")

			expect(manager.getLockHolder("/project/b.ts")).toBe("task-2")
		})

		it("should be a no-op when the task has no locks", () => {
			// Should not throw
			manager.releaseAllLocks("task-nonexistent")
		})
	})

	describe("getLockHolder", () => {
		it("should return undefined for unlocked files", () => {
			expect(manager.getLockHolder("/project/foo.ts")).toBeUndefined()
		})

		it("should return the task ID for locked files", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			expect(manager.getLockHolder("/project/foo.ts")).toBe("task-1")
		})
	})

	describe("getLockInfo", () => {
		it("should return undefined for unlocked files", () => {
			expect(manager.getLockInfo("/project/foo.ts")).toBeUndefined()
		})

		it("should return a copy of the lock info", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			const info = manager.getLockInfo("/project/foo.ts")
			expect(info).toBeDefined()
			expect(info!.taskId).toBe("task-1")
			expect(info!.filePath).toBe(path.resolve("/project/foo.ts"))
			expect(info!.acquiredAt).toBeGreaterThan(0)
		})
	})

	describe("getLockConflict", () => {
		it("should return undefined when file is not locked", () => {
			expect(manager.getLockConflict("/project/foo.ts", "task-1")).toBeUndefined()
		})

		it("should return undefined when the requesting task holds the lock", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			expect(manager.getLockConflict("/project/foo.ts", "task-1")).toBeUndefined()
		})

		it("should return conflict details when another task holds the lock", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			const conflict = manager.getLockConflict("/project/foo.ts", "task-2")
			expect(conflict).toBeDefined()
			expect(conflict!.holdingTaskId).toBe("task-1")
			expect(conflict!.filePath).toBe(path.resolve("/project/foo.ts"))
			expect(conflict!.heldForMs).toBeGreaterThanOrEqual(0)
		})
	})

	describe("getLockedFiles", () => {
		it("should return empty array for a task with no locks", () => {
			expect(manager.getLockedFiles("task-1")).toEqual([])
		})

		it("should return all files locked by a task", () => {
			manager.acquireLock("/project/a.ts", "task-1")
			manager.acquireLock("/project/b.ts", "task-1")
			const files = manager.getLockedFiles("task-1")
			expect(files).toHaveLength(2)
			expect(files).toContain(path.resolve("/project/a.ts"))
			expect(files).toContain(path.resolve("/project/b.ts"))
		})
	})

	describe("getAllLocks", () => {
		it("should return empty array when no locks exist", () => {
			expect(manager.getAllLocks()).toEqual([])
		})

		it("should return all active locks", () => {
			manager.acquireLock("/project/a.ts", "task-1")
			manager.acquireLock("/project/b.ts", "task-2")
			const allLocks = manager.getAllLocks()
			expect(allLocks).toHaveLength(2)
		})
	})

	describe("lockCount", () => {
		it("should return 0 initially", () => {
			expect(manager.lockCount).toBe(0)
		})

		it("should track the number of active locks", () => {
			manager.acquireLock("/project/a.ts", "task-1")
			expect(manager.lockCount).toBe(1)
			manager.acquireLock("/project/b.ts", "task-1")
			expect(manager.lockCount).toBe(2)
			manager.releaseLock("/project/a.ts", "task-1")
			expect(manager.lockCount).toBe(1)
		})
	})

	describe("lock expiration", () => {
		it("should auto-expire locks after timeout and allow reacquisition", () => {
			const shortTimeoutManager = new FileLockManager({ lockTimeoutMs: 50 })

			shortTimeoutManager.acquireLock("/project/foo.ts", "task-1")
			expect(shortTimeoutManager.getLockHolder("/project/foo.ts")).toBe("task-1")

			// Simulate time passing by directly manipulating the lock's acquiredAt
			const locks = (shortTimeoutManager as any).locks as Map<string, any>
			const normalized = path.resolve("/project/foo.ts")
			const lockInfo = locks.get(normalized)
			lockInfo.acquiredAt = Date.now() - 100 // 100ms ago, > 50ms timeout

			// The lock should now be considered expired
			expect(shortTimeoutManager.getLockHolder("/project/foo.ts")).toBeUndefined()
			expect(shortTimeoutManager.acquireLock("/project/foo.ts", "task-2")).toBe(true)

			shortTimeoutManager.dispose()
		})

		it("should auto-expire locks during acquireLock by another task", () => {
			const shortTimeoutManager = new FileLockManager({ lockTimeoutMs: 50 })

			shortTimeoutManager.acquireLock("/project/foo.ts", "task-1")

			// Simulate expiry
			const locks = (shortTimeoutManager as any).locks as Map<string, any>
			const normalized = path.resolve("/project/foo.ts")
			locks.get(normalized).acquiredAt = Date.now() - 100

			// Another task should be able to acquire the expired lock
			expect(shortTimeoutManager.acquireLock("/project/foo.ts", "task-2")).toBe(true)
			expect(shortTimeoutManager.getLockHolder("/project/foo.ts")).toBe("task-2")

			shortTimeoutManager.dispose()
		})

		it("should clean up expired locks during getAllLocks", () => {
			const shortTimeoutManager = new FileLockManager({ lockTimeoutMs: 50 })

			shortTimeoutManager.acquireLock("/project/a.ts", "task-1")
			shortTimeoutManager.acquireLock("/project/b.ts", "task-2")

			// Expire only task-1's lock
			const locks = (shortTimeoutManager as any).locks as Map<string, any>
			locks.get(path.resolve("/project/a.ts")).acquiredAt = Date.now() - 100

			const allLocks = shortTimeoutManager.getAllLocks()
			expect(allLocks).toHaveLength(1)
			expect(allLocks[0].taskId).toBe("task-2")

			shortTimeoutManager.dispose()
		})

		it("should return undefined from getLockConflict for expired locks", () => {
			const shortTimeoutManager = new FileLockManager({ lockTimeoutMs: 50 })

			shortTimeoutManager.acquireLock("/project/foo.ts", "task-1")

			// Expire the lock
			const locks = (shortTimeoutManager as any).locks as Map<string, any>
			locks.get(path.resolve("/project/foo.ts")).acquiredAt = Date.now() - 100

			expect(shortTimeoutManager.getLockConflict("/project/foo.ts", "task-2")).toBeUndefined()

			shortTimeoutManager.dispose()
		})
	})

	describe("events", () => {
		it("should emit lock-acquired events", () => {
			const events: FileLockEvent[] = []
			manager.onEvent((e) => events.push(e))

			manager.acquireLock("/project/foo.ts", "task-1")

			expect(events).toHaveLength(1)
			expect(events[0].type).toBe("lock-acquired")
			expect(events[0].taskId).toBe("task-1")
		})

		it("should emit lock-released events", () => {
			const events: FileLockEvent[] = []
			manager.acquireLock("/project/foo.ts", "task-1")

			manager.onEvent((e) => events.push(e))
			manager.releaseLock("/project/foo.ts", "task-1")

			expect(events).toHaveLength(1)
			expect(events[0].type).toBe("lock-released")
		})

		it("should emit all-locks-released events", () => {
			const events: FileLockEvent[] = []
			manager.acquireLock("/project/a.ts", "task-1")
			manager.acquireLock("/project/b.ts", "task-1")

			manager.onEvent((e) => events.push(e))
			manager.releaseAllLocks("task-1")

			expect(events).toHaveLength(1)
			expect(events[0].type).toBe("all-locks-released")
			if (events[0].type === "all-locks-released") {
				expect(events[0].count).toBe(2)
			}
		})

		it("should emit lock-expired events when a lock times out", () => {
			const shortTimeoutManager = new FileLockManager({ lockTimeoutMs: 50 })
			const events: FileLockEvent[] = []
			shortTimeoutManager.onEvent((e) => events.push(e))

			shortTimeoutManager.acquireLock("/project/foo.ts", "task-1")

			// Expire the lock
			const locks = (shortTimeoutManager as any).locks as Map<string, any>
			locks.get(path.resolve("/project/foo.ts")).acquiredAt = Date.now() - 100

			// Trigger expiration check via getLockHolder
			shortTimeoutManager.getLockHolder("/project/foo.ts")

			const expiredEvents = events.filter((e) => e.type === "lock-expired")
			expect(expiredEvents).toHaveLength(1)

			shortTimeoutManager.dispose()
		})

		it("should allow removing event listeners", () => {
			const events: FileLockEvent[] = []
			const listener = (e: FileLockEvent) => events.push(e)

			manager.onEvent(listener)
			manager.acquireLock("/project/foo.ts", "task-1")
			expect(events).toHaveLength(1)

			manager.offEvent(listener)
			manager.acquireLock("/project/bar.ts", "task-1")
			expect(events).toHaveLength(1) // No new events
		})

		it("should not throw if a listener throws", () => {
			manager.onEvent(() => {
				throw new Error("listener error")
			})

			// Should not throw
			expect(() => manager.acquireLock("/project/foo.ts", "task-1")).not.toThrow()
		})
	})

	describe("dispose", () => {
		it("should clear all locks and listeners", () => {
			const events: FileLockEvent[] = []
			manager.onEvent((e) => events.push(e))

			manager.acquireLock("/project/a.ts", "task-1")
			manager.acquireLock("/project/b.ts", "task-2")
			manager.dispose()

			expect(manager.lockCount).toBe(0)
			expect(manager.getAllLocks()).toEqual([])

			// Listener should have been removed
			manager.acquireLock("/project/c.ts", "task-3")
			expect(events).toHaveLength(2) // Only the pre-dispose events
		})
	})

	describe("re-entrant lock refresh", () => {
		it("should refresh the acquiredAt timestamp on re-entrant lock", () => {
			manager.acquireLock("/project/foo.ts", "task-1")
			const info1 = manager.getLockInfo("/project/foo.ts")

			// Small delay to ensure timestamp differs
			const originalTime = info1!.acquiredAt

			// Manipulate time to verify refresh
			const locks = (manager as any).locks as Map<string, any>
			const normalized = path.resolve("/project/foo.ts")
			locks.get(normalized).acquiredAt = originalTime - 1000

			manager.acquireLock("/project/foo.ts", "task-1")
			const info2 = manager.getLockInfo("/project/foo.ts")
			expect(info2!.acquiredAt).toBeGreaterThan(originalTime - 1000)
		})
	})
})
