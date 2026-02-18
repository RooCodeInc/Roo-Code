// npx vitest run tests/hooks/HookEngine.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { HookEngine } from "../../src/hooks/HookEngine"
import type {
	ToolExecutionContext,
	PreHookResult,
	PostHookResult,
} from "../../specs/001-intent-hook-middleware/contracts/hook-engine"

describe("HookEngine", () => {
	let hookEngine: HookEngine

	beforeEach(() => {
		hookEngine = new HookEngine()
	})

	describe("registerPreHook", () => {
		it("should register a pre-hook function", () => {
			const preHook = vi.fn().mockResolvedValue({ allowed: true })

			hookEngine.registerPreHook(preHook)

			// Hook is registered (we'll verify by executing it)
			expect(preHook).not.toHaveBeenCalled()
		})

		it("should execute registered pre-hooks in order", async () => {
			const executionOrder: number[] = []
			const preHook1 = vi.fn().mockImplementation(async () => {
				executionOrder.push(1)
				return { allowed: true }
			})
			const preHook2 = vi.fn().mockImplementation(async () => {
				executionOrder.push(2)
				return { allowed: true }
			})

			hookEngine.registerPreHook(preHook1)
			hookEngine.registerPreHook(preHook2)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			await hookEngine.executePreHooks(context)

			expect(executionOrder).toEqual([1, 2])
			expect(preHook1).toHaveBeenCalledWith(context)
			expect(preHook2).toHaveBeenCalledWith(context)
		})
	})

	describe("registerPostHook", () => {
		it("should register a post-hook function", () => {
			const postHook = vi.fn().mockResolvedValue({ success: true })

			hookEngine.registerPostHook(postHook)

			// Hook is registered (we'll verify by executing it)
			expect(postHook).not.toHaveBeenCalled()
		})

		it("should execute registered post-hooks in order", async () => {
			const executionOrder: number[] = []
			const postHook1 = vi.fn().mockImplementation(async () => {
				executionOrder.push(1)
				return { success: true }
			})
			const postHook2 = vi.fn().mockImplementation(async () => {
				executionOrder.push(2)
				return { success: true }
			})

			hookEngine.registerPostHook(postHook1)
			hookEngine.registerPostHook(postHook2)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}
			const result = { success: true }

			await hookEngine.executePostHooks(context, result)

			expect(executionOrder).toEqual([1, 2])
			expect(postHook1).toHaveBeenCalledWith(context, result)
			expect(postHook2).toHaveBeenCalledWith(context, result)
		})
	})

	describe("executePreHooks", () => {
		it("should return allowed=true when all pre-hooks allow", async () => {
			const preHook1 = vi.fn().mockResolvedValue({ allowed: true })
			const preHook2 = vi.fn().mockResolvedValue({ allowed: true })

			hookEngine.registerPreHook(preHook1)
			hookEngine.registerPreHook(preHook2)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			const result = await hookEngine.executePreHooks(context)

			expect(result.allowed).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("should return allowed=false when any pre-hook blocks", async () => {
			const preHook1 = vi.fn().mockResolvedValue({ allowed: true })
			const preHook2 = vi.fn().mockResolvedValue({
				allowed: false,
				error: "Intent not selected",
			})

			hookEngine.registerPreHook(preHook1)
			hookEngine.registerPreHook(preHook2)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			const result = await hookEngine.executePreHooks(context)

			expect(result.allowed).toBe(false)
			expect(result.error).toBe("Intent not selected")
		})

		it("should stop execution when first pre-hook blocks", async () => {
			const preHook1 = vi.fn().mockResolvedValue({
				allowed: false,
				error: "Blocked by first hook",
			})
			const preHook2 = vi.fn().mockResolvedValue({ allowed: true })

			hookEngine.registerPreHook(preHook1)
			hookEngine.registerPreHook(preHook2)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			const result = await hookEngine.executePreHooks(context)

			expect(result.allowed).toBe(false)
			expect(preHook1).toHaveBeenCalled()
			expect(preHook2).not.toHaveBeenCalled()
		})

		it("should handle pre-hook errors gracefully", async () => {
			const preHook = vi.fn().mockRejectedValue(new Error("Hook error"))

			hookEngine.registerPreHook(preHook)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}

			const result = await hookEngine.executePreHooks(context)

			expect(result.allowed).toBe(false)
			expect(result.error).toContain("Hook error")
		})
	})

	describe("executePostHooks", () => {
		it("should execute all post-hooks even if one fails", async () => {
			const postHook1 = vi.fn().mockResolvedValue({ success: true })
			const postHook2 = vi.fn().mockRejectedValue(new Error("Post hook error"))
			const postHook3 = vi.fn().mockResolvedValue({ success: true })

			hookEngine.registerPostHook(postHook1)
			hookEngine.registerPostHook(postHook2)
			hookEngine.registerPostHook(postHook3)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}
			const result = { success: true }

			const postResult = await hookEngine.executePostHooks(context, result)

			expect(postHook1).toHaveBeenCalled()
			expect(postHook2).toHaveBeenCalled()
			expect(postHook3).toHaveBeenCalled()
			// Post-hooks should not block execution, but errors should be logged
			expect(postResult.success).toBe(true)
		})

		it("should return success=true when all post-hooks succeed", async () => {
			const postHook1 = vi.fn().mockResolvedValue({ success: true })
			const postHook2 = vi.fn().mockResolvedValue({ success: true })

			hookEngine.registerPostHook(postHook1)
			hookEngine.registerPostHook(postHook2)

			const context: ToolExecutionContext = {
				toolName: "write_to_file",
				toolParams: { path: "test.ts", content: "test" },
				taskId: "task-123",
				workspacePath: "/workspace",
			}
			const result = { success: true }

			const postResult = await hookEngine.executePostHooks(context, result)

			expect(postResult.success).toBe(true)
		})
	})
})
