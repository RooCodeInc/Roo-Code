/**
 * Tests for ToolExecutionHooks
 *
 * Covers:
 * - Master toggle (hooksEnabled) enforcement
 * - Pre/Post tool use hook execution
 * - Permission request hooks
 * - Backwards compatibility when no getter is provided
 */

import {
	ToolExecutionHooks,
	createToolExecutionHooks,
	type ToolExecutionContext,
	type HookStatusCallback,
	type SayCallback,
	type HooksEnabledGetter,
} from "../ToolExecutionHooks"
import type { IHookManager, HooksExecutionResult, HooksConfigSnapshot } from "../types"

describe("ToolExecutionHooks", () => {
	// Mock IHookManager
	const createMockHookManager = (): IHookManager => ({
		loadHooksConfig: vi.fn(),
		reloadHooksConfig: vi.fn(),
		getConfigSnapshot: vi.fn().mockReturnValue({} as HooksConfigSnapshot),
		executeHooks: vi.fn().mockResolvedValue({
			results: [],
			blocked: false,
			totalDuration: 100,
		} as HooksExecutionResult),
		setHookEnabled: vi.fn(),
		updateHook: vi.fn(),
		getEnabledHooks: vi.fn().mockReturnValue([]),
		getHookExecutionHistory: vi.fn().mockReturnValue([]),
	})

	const createMockContext = (): ToolExecutionContext => ({
		toolName: "Write",
		toolInput: { filePath: "/test/file.ts", content: "test" },
		session: { taskId: "task_1", sessionId: "session_1", mode: "code" },
		project: { directory: "/test/project", name: "test-project" },
	})

	describe("Master toggle (hooksEnabled) enforcement", () => {
		it("should not execute hooks when hooksEnabledGetter returns false", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			const result = await hooks.executePreToolUse(createMockContext())

			expect(result.proceed).toBe(true)
			expect(result.hookResult.results).toEqual([])
			expect(result.hookResult.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should execute hooks when hooksEnabledGetter returns true", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			await hooks.executePreToolUse(createMockContext())

			expect(mockManager.executeHooks).toHaveBeenCalledWith("PreToolUse", expect.any(Object))
		})

		it("should default to enabled when no getter is provided (backwards compatibility)", async () => {
			const mockManager = createMockHookManager()

			// No hooksEnabledGetter provided
			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, undefined)

			await hooks.executePreToolUse(createMockContext())

			expect(mockManager.executeHooks).toHaveBeenCalled()
		})

		it("should not execute PostToolUse hooks when disabled", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			const result = await hooks.executePostToolUse(createMockContext(), "output", 100)

			expect(result.results).toEqual([])
			expect(result.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should not execute PostToolUseFailure hooks when disabled", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			const result = await hooks.executePostToolUseFailure(createMockContext(), "error", "error message")

			expect(result.results).toEqual([])
			expect(result.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should not execute PermissionRequest hooks when disabled", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			const result = await hooks.executePermissionRequest(createMockContext())

			expect(result.proceed).toBe(true)
			expect(result.hookResult.results).toEqual([])
			expect(result.hookResult.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("hasHooks should return false when disabled", () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			expect(hooks.hasHooks()).toBe(false)
		})

		it("hasHooks should return true when enabled and manager has config", () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			expect(hooks.hasHooks()).toBe(true)
		})
	})

	describe("createToolExecutionHooks factory", () => {
		it("should create instance with hooksEnabledGetter", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = createToolExecutionHooks(mockManager, undefined, undefined, hooksEnabledGetter)

			// Verify hooks don't execute when disabled
			await hooks.executePreToolUse(createMockContext())
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should work without hooksEnabledGetter for backwards compatibility", async () => {
			const mockManager = createMockHookManager()

			const hooks = createToolExecutionHooks(mockManager, undefined, undefined)

			await hooks.executePreToolUse(createMockContext())
			expect(mockManager.executeHooks).toHaveBeenCalled()
		})
	})

	describe("setHooksEnabledGetter", () => {
		it("should allow updating the getter after construction", async () => {
			const mockManager = createMockHookManager()

			const hooks = new ToolExecutionHooks(mockManager, undefined, undefined, () => true)

			// First call with enabled
			await hooks.executePreToolUse(createMockContext())
			expect(mockManager.executeHooks).toHaveBeenCalledTimes(1)

			// Update getter to disabled
			hooks.setHooksEnabledGetter(() => false)

			// Second call with disabled
			await hooks.executePreToolUse(createMockContext())
			expect(mockManager.executeHooks).toHaveBeenCalledTimes(1) // Still 1, no new call
		})
	})

	describe("No hook manager", () => {
		it("should return default results when hookManager is null", async () => {
			const hooks = new ToolExecutionHooks(null, undefined, undefined, () => true)

			const result = await hooks.executePreToolUse(createMockContext())

			expect(result.proceed).toBe(true)
			expect(result.hookResult.results).toEqual([])
		})

		it("hasHooks should return false when hookManager is null", () => {
			const hooks = new ToolExecutionHooks(null, undefined, undefined, () => true)

			expect(hooks.hasHooks()).toBe(false)
		})
	})

	describe("Status callback", () => {
		it("should not emit status when disabled", async () => {
			const mockManager = createMockHookManager()
			const statusCallback: HookStatusCallback = vi.fn()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(mockManager, statusCallback, undefined, hooksEnabledGetter)

			await hooks.executePreToolUse(createMockContext())

			expect(statusCallback).not.toHaveBeenCalled()
		})

		it("should emit status when enabled", async () => {
			const mockManager = createMockHookManager()
			const statusCallback: HookStatusCallback = vi.fn()
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(mockManager, statusCallback, undefined, hooksEnabledGetter)

			await hooks.executePreToolUse(createMockContext())

			expect(statusCallback).toHaveBeenCalled()
		})
	})
})
