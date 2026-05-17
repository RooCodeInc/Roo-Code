import path from "path"

import { FileLockManager } from "../FileLockManager"
import { LockGuardedToolExecutor, extractWriteTargetPaths, WRITE_TOOL_NAMES } from "../LockGuardedToolExecutor"

describe("extractWriteTargetPaths", () => {
	it("extracts path from write_to_file params", () => {
		expect(extractWriteTargetPaths("write_to_file", { path: "src/foo.ts", content: "hello" })).toEqual([
			"src/foo.ts",
		])
	})

	it("extracts path from apply_diff params", () => {
		expect(extractWriteTargetPaths("apply_diff", { path: "lib/bar.ts", diff: "---" })).toEqual(["lib/bar.ts"])
	})

	it("extracts file_path from edit_file params", () => {
		expect(
			extractWriteTargetPaths("edit_file", {
				file_path: "a/b.ts",
				old_string: "x",
				new_string: "y",
			}),
		).toEqual(["a/b.ts"])
	})

	it("extracts file_path from search_replace params", () => {
		expect(
			extractWriteTargetPaths("search_replace", {
				file_path: "c/d.ts",
				old_string: "x",
				new_string: "y",
			}),
		).toEqual(["c/d.ts"])
	})

	it("extracts file_path from search_and_replace params", () => {
		expect(
			extractWriteTargetPaths("search_and_replace", {
				file_path: "e/f.ts",
				old_string: "x",
				new_string: "y",
			}),
		).toEqual(["e/f.ts"])
	})

	it("extracts multiple paths from apply_patch params", () => {
		const patch = [
			"*** Update File: src/a.ts",
			"some diff content",
			"*** Add File: src/b.ts",
			"file content",
			"*** Delete File: src/c.ts",
		].join("\n")

		expect(extractWriteTargetPaths("apply_patch", { patch })).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"])
	})

	it("returns empty array for apply_patch with no recognizable paths", () => {
		expect(extractWriteTargetPaths("apply_patch", { patch: "random content" })).toEqual([])
	})

	it("returns empty array for apply_patch with empty/missing patch", () => {
		expect(extractWriteTargetPaths("apply_patch", { patch: "" })).toEqual([])
		expect(extractWriteTargetPaths("apply_patch", {})).toEqual([])
	})

	it("returns empty array for missing path param", () => {
		expect(extractWriteTargetPaths("write_to_file", {})).toEqual([])
		expect(extractWriteTargetPaths("write_to_file", { path: "" })).toEqual([])
	})

	it("returns empty array for non-write tools", () => {
		expect(extractWriteTargetPaths("read_file", { path: "foo.ts" })).toEqual([])
		expect(extractWriteTargetPaths("list_files", { path: "." })).toEqual([])
	})
})

describe("WRITE_TOOL_NAMES", () => {
	it("contains all expected write tools", () => {
		expect(WRITE_TOOL_NAMES.has("write_to_file")).toBe(true)
		expect(WRITE_TOOL_NAMES.has("apply_diff")).toBe(true)
		expect(WRITE_TOOL_NAMES.has("apply_patch")).toBe(true)
		expect(WRITE_TOOL_NAMES.has("edit_file")).toBe(true)
		expect(WRITE_TOOL_NAMES.has("search_replace")).toBe(true)
		expect(WRITE_TOOL_NAMES.has("search_and_replace")).toBe(true)
	})

	it("does not contain read tools", () => {
		expect(WRITE_TOOL_NAMES.has("read_file")).toBe(false)
		expect(WRITE_TOOL_NAMES.has("list_files")).toBe(false)
	})
})

describe("LockGuardedToolExecutor", () => {
	let lockManager: FileLockManager
	let executor: LockGuardedToolExecutor
	const cwd = "/workspace"

	beforeEach(() => {
		lockManager = new FileLockManager()
		executor = new LockGuardedToolExecutor(lockManager)
	})

	afterEach(() => {
		lockManager.dispose()
	})

	describe("isWriteTool", () => {
		it("returns true for write tools", () => {
			expect(executor.isWriteTool("write_to_file")).toBe(true)
			expect(executor.isWriteTool("apply_diff")).toBe(true)
			expect(executor.isWriteTool("apply_patch")).toBe(true)
			expect(executor.isWriteTool("edit_file")).toBe(true)
			expect(executor.isWriteTool("search_replace")).toBe(true)
		})

		it("returns false for non-write tools", () => {
			expect(executor.isWriteTool("read_file")).toBe(false)
			expect(executor.isWriteTool("list_files")).toBe(false)
			expect(executor.isWriteTool("execute_command")).toBe(false)
		})
	})

	describe("tryAcquireLocks", () => {
		it("returns success with empty lockedPaths for non-write tools", () => {
			const result = executor.tryAcquireLocks("read_file", { path: "foo.ts" }, "task-1", cwd)
			expect(result).toEqual({ success: true, lockedPaths: [] })
		})

		it("returns success with empty lockedPaths when no paths extracted", () => {
			const result = executor.tryAcquireLocks("write_to_file", {}, "task-1", cwd)
			expect(result).toEqual({ success: true, lockedPaths: [] })
		})

		it("acquires lock for a single file write", () => {
			const result = executor.tryAcquireLocks(
				"write_to_file",
				{ path: "src/foo.ts", content: "hello" },
				"task-1",
				cwd,
			)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.lockedPaths).toHaveLength(1)
				expect(result.lockedPaths[0]).toBe(path.resolve(cwd, "src/foo.ts"))
			}

			// Verify the lock is held in the manager
			expect(lockManager.getLockHolder(path.resolve(cwd, "src/foo.ts"))).toBe("task-1")
		})

		it("acquires locks for multiple files in apply_patch", () => {
			const patch = ["*** Update File: src/a.ts", "diff", "*** Add File: src/b.ts", "content"].join("\n")

			const result = executor.tryAcquireLocks("apply_patch", { patch }, "task-1", cwd)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.lockedPaths).toHaveLength(2)
			}
		})

		it("allows re-entrant lock by same task", () => {
			// First acquire
			const result1 = executor.tryAcquireLocks(
				"write_to_file",
				{ path: "src/foo.ts", content: "a" },
				"task-1",
				cwd,
			)
			expect(result1.success).toBe(true)

			// Same task, same file -- should succeed (re-entrant)
			const result2 = executor.tryAcquireLocks(
				"write_to_file",
				{ path: "src/foo.ts", content: "b" },
				"task-1",
				cwd,
			)
			expect(result2.success).toBe(true)
		})

		it("fails when another task holds the lock", () => {
			// Task 1 locks the file
			lockManager.acquireLock(path.resolve(cwd, "src/foo.ts"), "task-1")

			// Task 2 tries to write
			const result = executor.tryAcquireLocks(
				"write_to_file",
				{ path: "src/foo.ts", content: "conflict" },
				"task-2",
				cwd,
			)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.conflicts).toHaveLength(1)
				expect(result.conflicts[0].holdingTaskId).toBe("task-1")
				expect(result.lockedPaths).toEqual([])
			}
		})

		it("uses all-or-nothing semantics for multi-file patches", () => {
			// Task 1 locks one of the files
			lockManager.acquireLock(path.resolve(cwd, "src/b.ts"), "task-1")

			const patch = ["*** Update File: src/a.ts", "diff a", "*** Update File: src/b.ts", "diff b"].join("\n")

			const result = executor.tryAcquireLocks("apply_patch", { patch }, "task-2", cwd)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.conflicts).toHaveLength(1)
				// a.ts should have been rolled back
				expect(result.lockedPaths).toEqual([])
			}

			// Verify a.ts was NOT left locked by task-2
			expect(lockManager.getLockHolder(path.resolve(cwd, "src/a.ts"))).toBeUndefined()
		})
	})

	describe("releaseLocks", () => {
		it("releases all specified locks", () => {
			const absPath = path.resolve(cwd, "src/foo.ts")
			lockManager.acquireLock(absPath, "task-1")

			executor.releaseLocks([absPath], "task-1")

			expect(lockManager.getLockHolder(absPath)).toBeUndefined()
		})

		it("is safe to call with empty array", () => {
			expect(() => executor.releaseLocks([], "task-1")).not.toThrow()
		})

		it("is safe to call for locks not held", () => {
			expect(() => executor.releaseLocks([path.resolve(cwd, "nonexistent.ts")], "task-1")).not.toThrow()
		})
	})

	describe("formatLockConflictError", () => {
		it("formats a readable error message", () => {
			const conflicts = [
				{
					filePath: "/workspace/src/foo.ts",
					holdingTaskId: "task-abc",
					heldForMs: 5000,
				},
			]

			const msg = LockGuardedToolExecutor.formatLockConflictError(conflicts)

			expect(msg).toContain("Cannot write")
			expect(msg).toContain("/workspace/src/foo.ts")
			expect(msg).toContain("task-abc")
			expect(msg).toContain("5s")
			expect(msg).toContain("Wait for the other task")
		})

		it("formats multiple conflicts", () => {
			const conflicts = [
				{ filePath: "/workspace/a.ts", holdingTaskId: "t1", heldForMs: 2000 },
				{ filePath: "/workspace/b.ts", holdingTaskId: "t2", heldForMs: 10000 },
			]

			const msg = LockGuardedToolExecutor.formatLockConflictError(conflicts)

			expect(msg).toContain("a.ts")
			expect(msg).toContain("b.ts")
			expect(msg).toContain("t1")
			expect(msg).toContain("t2")
		})
	})
})
