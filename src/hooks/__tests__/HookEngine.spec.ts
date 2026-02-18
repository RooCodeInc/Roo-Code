import { describe, it, expect } from "vitest"
import { HookEngine } from "../HookEngine"
import type { Task } from "../../core/task/Task"

describe("HookEngine", () => {
	it("should be a singleton", () => {
		const instance1 = HookEngine.getInstance()
		const instance2 = HookEngine.getInstance()
		expect(instance1).toBe(instance2)
	})

	it("should execute pre-hook without errors", async () => {
		const hookEngine = HookEngine.getInstance()
		const result = await hookEngine.executePreHook({
			toolName: "write_to_file",
			params: { path: "test.ts", content: "test" },
			task: {} as Task,
		})

		expect(result.blocked).toBe(false)
	})

	it("should execute post-hook without errors", async () => {
		const hookEngine = HookEngine.getInstance()
		await expect(
			hookEngine.executePostHook({
				toolName: "write_to_file",
				params: { path: "test.ts" },
				result: "success",
				task: {} as Task,
			}),
		).resolves.toBeUndefined()
	})

	it("should not throw on pre-hook error", async () => {
		const hookEngine = HookEngine.getInstance()
		// Pass invalid context to trigger error
		const result = await hookEngine.executePreHook(null as any)
		expect(result.blocked).toBe(false) // Fail-safe
	})
})
