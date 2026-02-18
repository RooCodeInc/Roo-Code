import { describe, it, expect, vi } from "vitest"

import { HookEngine } from "../HookEngine"
import { RequireIntentPreHook } from "../builtin/RequireIntentPreHook"
import type { HookContext, PreToolHook, PostToolHook, PostToolHookContext } from "../types"

const baseContext: HookContext = {
	taskId: "task-001",
	toolName: "write_to_file",
	toolArgs: {},
	cwd: "/tmp",
	timestamp: "2026-02-18T00:00:00Z",
}

// ─── HookEngine ───────────────────────────────────────────────────────────────

describe("HookEngine", () => {
	it("allows when no pre-hooks are registered", async () => {
		const engine = new HookEngine()
		const decision = await engine.runPreHooks(baseContext)
		expect(decision.allow).toBe(true)
	})

	it("allows when all pre-hooks return allow:true", async () => {
		const engine = new HookEngine()
		const hook: PreToolHook = {
			name: "always-allow",
			run: () => ({ allow: true }),
		}
		engine.registerPreHook(hook)
		const decision = await engine.runPreHooks(baseContext)
		expect(decision.allow).toBe(true)
	})

	it("blocks when any pre-hook returns allow:false", async () => {
		const engine = new HookEngine()
		engine.registerPreHook({
			name: "always-block",
			run: () => ({ allow: false, code: "INTENT_REQUIRED" as const, reason: "test block" }),
		})
		const decision = await engine.runPreHooks(baseContext)
		expect(decision.allow).toBe(false)
		if (!decision.allow) {
			expect(decision.code).toBe("INTENT_REQUIRED")
			expect(decision.reason).toContain("test block")
		}
	})

	it("merges contextPatch from multiple pre-hooks", async () => {
		const engine = new HookEngine()
		engine.registerPreHook({
			name: "patch-a",
			run: () => ({ allow: true, contextPatch: { a: 1 } }),
		})
		engine.registerPreHook({
			name: "patch-b",
			run: () => ({ allow: true, contextPatch: { b: 2 } }),
		})
		const decision = await engine.runPreHooks(baseContext)
		expect(decision.allow).toBe(true)
		if (decision.allow) {
			expect(decision.contextPatch).toMatchObject({ a: 1, b: 2 })
		}
	})

	it("stops at first blocking pre-hook (fail-closed)", async () => {
		const engine = new HookEngine()
		const laterHook: PreToolHook = { name: "later", run: vi.fn(() => ({ allow: true as const })) }
		engine.registerPreHook({
			name: "blocker",
			run: () => ({ allow: false, code: "SCOPE_VIOLATION" as const, reason: "scope" }),
		})
		engine.registerPreHook(laterHook)
		await engine.runPreHooks(baseContext)
		expect(laterHook.run).not.toHaveBeenCalled()
	})

	it("runs all post-hooks even if one throws (fail-safe)", async () => {
		const engine = new HookEngine()
		const secondHook: PostToolHook = { name: "second", run: vi.fn() }
		engine.registerPostHook({
			name: "throwing",
			run: () => {
				throw new Error("post-hook failure")
			},
		})
		engine.registerPostHook(secondHook)
		const postCtx: PostToolHookContext = { ...baseContext, toolResult: null, changedFiles: [] }
		await engine.runPostHooks(postCtx) // must not throw
		expect(secondHook.run).toHaveBeenCalled()
	})
})

// ─── RequireIntentPreHook ─────────────────────────────────────────────────────

describe("RequireIntentPreHook", () => {
	const hook = new RequireIntentPreHook()

	it("allows read-only tools without intent_id", () => {
		const ctx: HookContext = { ...baseContext, toolName: "read_file", toolArgs: {} }
		const decision = hook.run(ctx)
		expect(decision.allow).toBe(true)
	})

	it("blocks write_to_file when intent_id is missing", () => {
		const ctx: HookContext = { ...baseContext, toolName: "write_to_file", toolArgs: {} }
		const decision = hook.run(ctx)
		expect(decision.allow).toBe(false)
		if (!decision.allow) {
			expect(decision.code).toBe("INTENT_REQUIRED")
		}
	})

	it("blocks execute_command when intent_id is missing", () => {
		const ctx: HookContext = { ...baseContext, toolName: "execute_command", toolArgs: {} }
		const decision = hook.run(ctx)
		expect(decision.allow).toBe(false)
	})

	it("allows write_to_file when intent_id is provided", () => {
		const ctx: HookContext = {
			...baseContext,
			toolName: "write_to_file",
			toolArgs: { intent_id: "INT-001" },
		}
		const decision = hook.run(ctx)
		expect(decision.allow).toBe(true)
		if (decision.allow) {
			expect(decision.contextPatch?.active_intent_id).toBe("INT-001")
		}
	})

	it("blocks when intent_id is empty string", () => {
		const ctx: HookContext = {
			...baseContext,
			toolName: "write_to_file",
			toolArgs: { intent_id: "" },
		}
		const decision = hook.run(ctx)
		expect(decision.allow).toBe(false)
	})
})
