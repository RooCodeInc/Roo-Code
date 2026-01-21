/**
 * Tests for ToolExecutionHooks
 *
 * Covers:
 * - Master toggle (hooksEnabled) enforcement
 * - Pre/Post tool use hook execution
 * - Permission request hooks
 * - Backwards compatibility when optional hooksEnabledGetter is omitted
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

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			const result = await hooks.executePreToolUse(createMockContext())

			expect(result.proceed).toBe(true)
			expect(result.hookResult.results).toEqual([])
			expect(result.hookResult.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should execute hooks when hooksEnabledGetter returns true", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			await hooks.executePreToolUse(createMockContext())

			expect(mockManager.executeHooks).toHaveBeenCalledWith("PreToolUse", expect.any(Object))
		})

		it("should default to enabled when no getter is provided (backwards compatibility)", async () => {
			const mockManager = createMockHookManager()

			// No hooksEnabledGetter provided
			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			)

			await hooks.executePreToolUse(createMockContext())

			expect(mockManager.executeHooks).toHaveBeenCalled()
		})

		it("should not execute PostToolUse hooks when disabled", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			const result = await hooks.executePostToolUse(createMockContext(), "output", 100)

			expect(result.results).toEqual([])
			expect(result.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should not execute PostToolUseFailure hooks when disabled", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			const result = await hooks.executePostToolUseFailure(createMockContext(), "error", "error message")

			expect(result.results).toEqual([])
			expect(result.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should not execute PermissionRequest hooks when disabled", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			const result = await hooks.executePermissionRequest(createMockContext())

			expect(result.proceed).toBe(true)
			expect(result.hookResult.results).toEqual([])
			expect(result.hookResult.totalDuration).toBe(0)
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("hasHooks should return false when disabled", () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			expect(hooks.hasHooks()).toBe(false)
		})

		it("hasHooks should return true when enabled and manager has config", () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			expect(hooks.hasHooks()).toBe(true)
		})
	})

	describe("createToolExecutionHooks factory", () => {
		it("should create instance with hooksEnabledGetter", async () => {
			const mockManager = createMockHookManager()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = createToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			// Verify hooks don't execute when disabled
			await hooks.executePreToolUse(createMockContext())
			expect(mockManager.executeHooks).not.toHaveBeenCalled()
		})

		it("should work without hooksEnabledGetter for backwards compatibility", async () => {
			const mockManager = createMockHookManager()

			const hooks = createToolExecutionHooks(() => mockManager, undefined, undefined, undefined)

			await hooks.executePreToolUse(createMockContext())
			expect(mockManager.executeHooks).toHaveBeenCalled()
		})
	})

	describe("setHooksEnabledGetter", () => {
		it("should allow updating the getter after construction", async () => {
			const mockManager = createMockHookManager()

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				undefined,
				undefined,
				() => true,
			)

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
			const hooks = new ToolExecutionHooks(
				() => null,
				undefined,
				undefined,
				undefined,
				undefined,
				() => true,
			)

			const result = await hooks.executePreToolUse(createMockContext())

			expect(result.proceed).toBe(true)
			expect(result.hookResult.results).toEqual([])
		})

		it("hasHooks should return false when hookManager is null", () => {
			const hooks = new ToolExecutionHooks(
				() => null,
				undefined,
				undefined,
				undefined,
				undefined,
				() => true,
			)

			expect(hooks.hasHooks()).toBe(false)
		})

		it("should resolve hook manager lazily (null first, then available)", async () => {
			let currentManager: IHookManager | null = null
			const hookManagerGetter = vi.fn(() => currentManager)

			const hooks = new ToolExecutionHooks(
				hookManagerGetter,
				undefined,
				undefined,
				undefined,
				undefined,
				() => true,
			)

			// First call: manager unavailable, should no-op.
			const firstResult = await hooks.executePreToolUse(createMockContext())
			expect(firstResult.proceed).toBe(true)
			expect(firstResult.hookResult.results).toEqual([])
			expect(firstResult.hookResult.totalDuration).toBe(0)
			expect(hookManagerGetter).toHaveBeenCalledTimes(1)

			// Later: manager becomes available.
			currentManager = createMockHookManager()
			await hooks.executePreToolUse(createMockContext())

			expect(hookManagerGetter).toHaveBeenCalledTimes(2)
			expect(currentManager.executeHooks).toHaveBeenCalledWith("PreToolUse", expect.any(Object))
		})
	})

	describe("Status callback", () => {
		it("should not emit status when disabled", async () => {
			const mockManager = createMockHookManager()
			const statusCallback: HookStatusCallback = vi.fn()
			const hooksEnabledGetter: HooksEnabledGetter = () => false

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				statusCallback,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			await hooks.executePreToolUse(createMockContext())

			expect(statusCallback).not.toHaveBeenCalled()
		})

		it("should emit status when enabled", async () => {
			const mockManager = createMockHookManager()
			const statusCallback: HookStatusCallback = vi.fn()
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				statusCallback,
				undefined,
				undefined,
				undefined,
				hooksEnabledGetter,
			)

			await hooks.executePreToolUse(createMockContext())

			expect(statusCallback).toHaveBeenCalled()
		})
	})

	describe("Persisted hook_execution rows", () => {
		it("should emit hook_execution on start and update it on completion", async () => {
			const mockManager = createMockHookManager()
			const sayCallback: SayCallback = vi.fn().mockResolvedValue(undefined)
			const updateSayCallback = vi.fn().mockResolvedValue(undefined)
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				sayCallback,
				updateSayCallback,
				hooksEnabledGetter,
			)

			await hooks.executePreToolUse(createMockContext())

			const executeArgs = (mockManager.executeHooks as any).mock.calls[0][1]
			expect(executeArgs.hookExecutionCallback).toEqual(expect.any(Function))

			// Deterministic messageTs for the persisted row.
			const nowSpy = vi.spyOn(Date, "now").mockReturnValueOnce(123456)

			await executeArgs.hookExecutionCallback({
				phase: "started",
				executionId: "exec_1",
				hookId: "hook_1",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo hi",
				cwd: "/test/project",
			})

			expect(sayCallback).toHaveBeenCalledTimes(1)
			expect(sayCallback).toHaveBeenCalledWith("hook_execution", expect.any(String))
			const startPayload = JSON.parse((sayCallback as any).mock.calls[0][1])
			expect(startPayload).toEqual(
				expect.objectContaining({
					executionId: "exec_1",
					hookId: "hook_1",
					event: "PreToolUse",
					toolName: "Write",
					command: "echo hi",
					messageTs: 123456,
				}),
			)

			await executeArgs.hookExecutionCallback({
				phase: "completed",
				executionId: "exec_1",
				hookId: "hook_1",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo hi",
				cwd: "/test/project",
				outputSummary: "ok",
				exitCode: 0,
				durationMs: 10,
				modified: false,
			})

			expect(updateSayCallback).toHaveBeenCalledTimes(1)
			expect(updateSayCallback).toHaveBeenCalledWith(123456, "hook_execution", expect.any(String))
			const updatePayload = JSON.parse((updateSayCallback as any).mock.calls[0][2])
			expect(updatePayload).toEqual(
				expect.objectContaining({
					executionId: "exec_1",
					hookId: "hook_1",
					event: "PreToolUse",
					toolName: "Write",
					command: "echo hi",
					messageTs: 123456,
					result: expect.objectContaining({
						phase: "completed",
						exitCode: 0,
						durationMs: 10,
						modified: false,
						outputSummary: "ok",
					}),
				}),
			)

			nowSpy.mockRestore()
		})

		it("should update persisted hook_execution row with blocked terminal state", async () => {
			const mockManager = createMockHookManager()
			const sayCallback: SayCallback = vi.fn().mockResolvedValue(undefined)
			const updateSayCallback = vi.fn().mockResolvedValue(undefined)
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				sayCallback,
				updateSayCallback,
				hooksEnabledGetter,
			)

			await hooks.executePreToolUse(createMockContext())
			const executeArgs = (mockManager.executeHooks as any).mock.calls[0][1]

			vi.spyOn(Date, "now").mockReturnValueOnce(111)
			await executeArgs.hookExecutionCallback({
				phase: "started",
				executionId: "exec_2",
				hookId: "hook_2",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo block",
				cwd: "/test/project",
			})

			await executeArgs.hookExecutionCallback({
				phase: "blocked",
				executionId: "exec_2",
				hookId: "hook_2",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo block",
				cwd: "/test/project",
				outputSummary: "blocked-output",
				exitCode: 2,
				durationMs: 12,
				blockMessage: "Policy violation",
				modified: true,
			})

			expect(updateSayCallback).toHaveBeenCalledTimes(1)
			const updatePayload = JSON.parse((updateSayCallback as any).mock.calls[0][2])
			expect(updatePayload.result).toEqual(
				expect.objectContaining({
					phase: "blocked",
					exitCode: 2,
					durationMs: 12,
					blockMessage: "Policy violation",
					modified: true,
					outputSummary: "blocked-output",
				}),
			)
		})

		it("should update persisted hook_execution row with failed terminal state", async () => {
			const mockManager = createMockHookManager()
			const sayCallback: SayCallback = vi.fn().mockResolvedValue(undefined)
			const updateSayCallback = vi.fn().mockResolvedValue(undefined)
			const hooksEnabledGetter: HooksEnabledGetter = () => true

			const hooks = new ToolExecutionHooks(
				() => mockManager,
				undefined,
				undefined,
				sayCallback,
				updateSayCallback,
				hooksEnabledGetter,
			)

			await hooks.executePreToolUse(createMockContext())
			const executeArgs = (mockManager.executeHooks as any).mock.calls[0][1]

			vi.spyOn(Date, "now").mockReturnValueOnce(222)
			await executeArgs.hookExecutionCallback({
				phase: "started",
				executionId: "exec_3",
				hookId: "hook_3",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo fail",
				cwd: "/test/project",
			})

			await executeArgs.hookExecutionCallback({
				phase: "failed",
				executionId: "exec_3",
				hookId: "hook_3",
				event: "PreToolUse",
				toolName: "Write",
				command: "echo fail",
				cwd: "/test/project",
				outputSummary: "failed-output",
				exitCode: 1,
				durationMs: 34,
				error: "Hook error",
			})

			expect(updateSayCallback).toHaveBeenCalledTimes(1)
			const updatePayload = JSON.parse((updateSayCallback as any).mock.calls[0][2])
			expect(updatePayload.result).toEqual(
				expect.objectContaining({
					phase: "failed",
					exitCode: 1,
					durationMs: 34,
					error: "Hook error",
					outputSummary: "failed-output",
				}),
			)
		})
	})
})
