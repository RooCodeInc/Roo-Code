import path from "path"

import { FileLockManager } from "../FileLockManager"
import { LockGuardedToolExecutor } from "../LockGuardedToolExecutor"
import { getFileLockManager, getLockGuardedToolExecutor, resetFileLockSingletons } from "../index"

describe("tool-runner-integration", () => {
	describe("singleton getters", () => {
		afterEach(() => {
			resetFileLockSingletons()
		})

		it("getFileLockManager returns a FileLockManager instance", () => {
			const manager = getFileLockManager()
			expect(manager).toBeInstanceOf(FileLockManager)
		})

		it("getFileLockManager returns the same instance on repeated calls", () => {
			const a = getFileLockManager()
			const b = getFileLockManager()
			expect(a).toBe(b)
		})

		it("getLockGuardedToolExecutor returns a LockGuardedToolExecutor instance", () => {
			const executor = getLockGuardedToolExecutor()
			expect(executor).toBeInstanceOf(LockGuardedToolExecutor)
		})

		it("getLockGuardedToolExecutor returns the same instance on repeated calls", () => {
			const a = getLockGuardedToolExecutor()
			const b = getLockGuardedToolExecutor()
			expect(a).toBe(b)
		})

		it("resetFileLockSingletons creates fresh instances", () => {
			const before = getFileLockManager()
			resetFileLockSingletons()
			const after = getFileLockManager()
			expect(before).not.toBe(after)
		})

		it("getLockGuardedToolExecutor uses getFileLockManager singleton", () => {
			const executor = getLockGuardedToolExecutor()
			const manager = getFileLockManager()

			// Acquire a lock through the manager, verify executor sees it
			const absPath = path.resolve("/workspace", "test.ts")
			manager.acquireLock(absPath, "task-1")

			const result = executor.tryAcquireLocks(
				"write_to_file",
				{ path: "test.ts", content: "hello" },
				"task-2",
				"/workspace",
			)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.conflicts[0].holdingTaskId).toBe("task-1")
			}
		})
	})

	describe("lock guard lifecycle in tool execution flow", () => {
		let lockManager: FileLockManager
		let executor: LockGuardedToolExecutor

		beforeEach(() => {
			lockManager = new FileLockManager()
			executor = new LockGuardedToolExecutor(lockManager)
		})

		it("acquires and releases locks around a successful write_to_file", () => {
			const cwd = "/workspace"
			const params = { path: "src/app.ts", content: "code" }
			const taskId = "task-1"

			// Acquire
			const result = executor.tryAcquireLocks("write_to_file", params, taskId, cwd)
			expect(result.success).toBe(true)
			if (!result.success) return

			// Lock is held
			const absPath = path.resolve(cwd, "src/app.ts")
			expect(lockManager.getLockHolder(absPath)).toBe(taskId)

			// Simulate tool execution...

			// Release
			executor.releaseLocks(result.lockedPaths, taskId)

			// Lock is released
			expect(lockManager.getLockHolder(absPath)).toBeUndefined()
		})

		it("acquires and releases locks around a successful apply_patch with multiple files", () => {
			const cwd = "/workspace"
			const patch = ["*** Update File: src/a.ts", "some diff", "*** Add File: src/b.ts", "some content"].join(
				"\n",
			)
			const params = { patch }
			const taskId = "task-1"

			const result = executor.tryAcquireLocks("apply_patch", params, taskId, cwd)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.lockedPaths).toHaveLength(2)

			// Both locks held
			expect(lockManager.getLockHolder(path.resolve(cwd, "src/a.ts"))).toBe(taskId)
			expect(lockManager.getLockHolder(path.resolve(cwd, "src/b.ts"))).toBe(taskId)

			// Release
			executor.releaseLocks(result.lockedPaths, taskId)

			// Both released
			expect(lockManager.getLockHolder(path.resolve(cwd, "src/a.ts"))).toBeUndefined()
			expect(lockManager.getLockHolder(path.resolve(cwd, "src/b.ts"))).toBeUndefined()
		})

		it("blocks a second task from writing to a locked file", () => {
			const cwd = "/workspace"
			const params = { path: "src/shared.ts", content: "x" }

			// Task 1 acquires
			const result1 = executor.tryAcquireLocks("write_to_file", params, "task-1", cwd)
			expect(result1.success).toBe(true)

			// Task 2 tries to write same file
			const result2 = executor.tryAcquireLocks("write_to_file", params, "task-2", cwd)
			expect(result2.success).toBe(false)
			if (!result2.success) {
				expect(result2.conflicts).toHaveLength(1)
				expect(result2.conflicts[0].holdingTaskId).toBe("task-1")
			}

			// Task 1 releases
			if (result1.success) {
				executor.releaseLocks(result1.lockedPaths, "task-1")
			}

			// Task 2 can now acquire
			const result3 = executor.tryAcquireLocks("write_to_file", params, "task-2", cwd)
			expect(result3.success).toBe(true)
		})

		it("releaseAllLocks on dispose frees all locks for a task", () => {
			const cwd = "/workspace"

			// Task 1 acquires locks on two files
			executor.tryAcquireLocks("write_to_file", { path: "a.ts", content: "a" }, "task-1", cwd)
			executor.tryAcquireLocks("write_to_file", { path: "b.ts", content: "b" }, "task-1", cwd)

			expect(lockManager.getLockHolder(path.resolve(cwd, "a.ts"))).toBe("task-1")
			expect(lockManager.getLockHolder(path.resolve(cwd, "b.ts"))).toBe("task-1")

			// Simulate Task.dispose() calling releaseAllLocks
			lockManager.releaseAllLocks("task-1")

			expect(lockManager.getLockHolder(path.resolve(cwd, "a.ts"))).toBeUndefined()
			expect(lockManager.getLockHolder(path.resolve(cwd, "b.ts"))).toBeUndefined()
		})

		it("does not acquire locks for read-only tools", () => {
			const cwd = "/workspace"
			const result = executor.tryAcquireLocks("read_file", { path: "a.ts" }, "task-1", cwd)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.lockedPaths).toEqual([])
			}
		})

		it("formats lock conflict errors with useful information", () => {
			const conflicts = [
				{
					filePath: "/workspace/src/shared.ts",
					holdingTaskId: "task-abc-123",
					heldForMs: 8000,
				},
			]
			const msg = LockGuardedToolExecutor.formatLockConflictError(conflicts)

			expect(msg).toContain("Cannot write")
			expect(msg).toContain("/workspace/src/shared.ts")
			expect(msg).toContain("task-abc-123")
			expect(msg).toContain("8s")
			expect(msg).toContain("Wait for the other task")
		})

		it("handles edit_file tool path extraction", () => {
			const cwd = "/workspace"
			const result = executor.tryAcquireLocks(
				"edit_file",
				{ file_path: "src/utils.ts", old_string: "a", new_string: "b" },
				"task-1",
				cwd,
			)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.lockedPaths).toHaveLength(1)
				expect(result.lockedPaths[0]).toBe(path.resolve(cwd, "src/utils.ts"))
			}
		})

		it("handles search_replace tool path extraction", () => {
			const cwd = "/workspace"
			const result = executor.tryAcquireLocks(
				"search_replace",
				{ file_path: "src/config.ts", old_string: "x", new_string: "y" },
				"task-1",
				cwd,
			)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.lockedPaths).toHaveLength(1)
				expect(result.lockedPaths[0]).toBe(path.resolve(cwd, "src/config.ts"))
			}
		})
	})
})
