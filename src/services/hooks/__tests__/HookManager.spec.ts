/**
 * Tests for HookManager
 *
 * Covers:
 * - Config loading and snapshot management
 * - Sequential hook execution
 * - Enable/disable functionality
 * - Execution history tracking
 */

import { HookManager, createHookManager } from "../HookManager"
import * as HookConfigLoader from "../HookConfigLoader"
import * as HookExecutor from "../HookExecutor"
import { Terminal } from "../../../integrations/terminal/Terminal"
import type { HooksConfigSnapshot, ResolvedHook, HookEventType, HookContext } from "../types"

// Mock dependencies
vi.mock("../HookConfigLoader")
vi.mock("../HookExecutor")

const mockLoadHooksConfig = vi.mocked(HookConfigLoader.loadHooksConfig)
const mockGetHooksForEvent = vi.mocked(HookConfigLoader.getHooksForEvent)
const mockExecuteHook = vi.mocked(HookExecutor.executeHook)
const mockInterpretResult = vi.mocked(HookExecutor.interpretResult)
const mockDescribeResult = vi.mocked(HookExecutor.describeResult)

describe("HookManager", () => {
	const createMockHook = (id: string, event: HookEventType = "PreToolUse"): ResolvedHook =>
		({
			id,
			matcher: "*",
			enabled: true,
			command: `echo ${id}`,
			timeout: 60,
			source: "project",
			event,
			filePath: "/test/hooks.yaml",
		}) as ResolvedHook

	const createMockSnapshot = (hooks: ResolvedHook[] = []): HooksConfigSnapshot => {
		const hooksByEvent = new Map<HookEventType, ResolvedHook[]>()
		const hooksById = new Map<string, ResolvedHook>()

		for (const hook of hooks) {
			if (!hooksByEvent.has(hook.event)) {
				hooksByEvent.set(hook.event, [])
			}
			hooksByEvent.get(hook.event)!.push(hook)
			hooksById.set(hook.id, hook)
		}

		return {
			hooksByEvent,
			hooksById,
			loadedAt: new Date(),
			disabledHookIds: new Set(),
			hasProjectHooks: hooks.some((h) => h.source === "project"),
		}
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockDescribeResult.mockReturnValue("Hook executed")
	})

	describe("loadHooksConfig", () => {
		it("should load config and return snapshot", async () => {
			const mockSnapshot = createMockSnapshot([createMockHook("hook1")])
			mockLoadHooksConfig.mockResolvedValue({
				snapshot: mockSnapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			const snapshot = await manager.loadHooksConfig()

			expect(mockLoadHooksConfig).toHaveBeenCalledWith({ cwd: "/project", mode: undefined })
			expect(snapshot).toBe(mockSnapshot)
		})

		it("should pass mode to config loader", async () => {
			const mockSnapshot = createMockSnapshot([])
			mockLoadHooksConfig.mockResolvedValue({
				snapshot: mockSnapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project", mode: "code" })
			await manager.loadHooksConfig()

			expect(mockLoadHooksConfig).toHaveBeenCalledWith({ cwd: "/project", mode: "code" })
		})

		it("should log errors and warnings", async () => {
			const mockSnapshot = createMockSnapshot([])
			const errorLog: string[] = []
			const warnLog: string[] = []

			mockLoadHooksConfig.mockResolvedValue({
				snapshot: mockSnapshot,
				errors: ["Config error 1"],
				warnings: ["Warning 1"],
			})

			const manager = createHookManager({
				cwd: "/project",
				logger: {
					debug: vi.fn(),
					info: vi.fn(),
					warn: (msg) => warnLog.push(msg),
					error: (msg) => errorLog.push(msg),
				},
			})

			await manager.loadHooksConfig()

			expect(errorLog.some((e) => e.includes("Config error 1"))).toBe(true)
			expect(warnLog.some((w) => w.includes("Warning 1"))).toBe(true)
		})
	})

	describe("reloadHooksConfig", () => {
		it("should reload config while preserving disabled hooks", async () => {
			const hook1 = createMockHook("hook1")
			const hook2 = createMockHook("hook2")

			// Initial load
			const initialSnapshot = createMockSnapshot([hook1, hook2])
			mockLoadHooksConfig.mockResolvedValueOnce({
				snapshot: initialSnapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			// Disable hook2
			await manager.setHookEnabled("hook2", false)

			// Reload with same hooks
			const reloadedSnapshot = createMockSnapshot([hook1, hook2])
			mockLoadHooksConfig.mockResolvedValueOnce({
				snapshot: reloadedSnapshot,
				errors: [],
				warnings: [],
			})

			await manager.reloadHooksConfig()

			const snapshot = manager.getConfigSnapshot()
			expect(snapshot?.disabledHookIds.has("hook2")).toBe(true)
		})
	})

	describe("executeHooks", () => {
		const createMockContext = (): HookContext => ({
			event: "PreToolUse",
			timestamp: "2026-01-16T12:00:00Z",
			session: { taskId: "task_1", sessionId: "session_1", mode: "code" },
			project: { directory: "/project", name: "test" },
			tool: { name: "Write", input: { filePath: "/test.ts", content: "test" } },
		})

		it("should call hookExecutionCallback on start and terminal state", async () => {
			const compressSpy = vi.spyOn(Terminal, "compressTerminalOutput").mockImplementation((s: string) => s)

			const hook1 = createMockHook("hook1")
			const snapshot = createMockSnapshot([hook1])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1])
			mockExecuteHook.mockResolvedValue({
				hook: hook1,
				exitCode: 0,
				stdout: "out",
				stderr: "err",
				duration: 100,
				timedOut: false,
			})
			mockInterpretResult.mockReturnValue({
				success: true,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			})

			const hookExecutionCallback = vi.fn()

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			await manager.executeHooks("PreToolUse", {
				context: createMockContext(),
				executionId: "base",
				hookExecutionCallback,
			})

			expect(hookExecutionCallback).toHaveBeenCalledTimes(2)
			const [startedEvt] = hookExecutionCallback.mock.calls[0]
			const [terminalEvt] = hookExecutionCallback.mock.calls[1]

			expect(startedEvt).toEqual(
				expect.objectContaining({
					phase: "started",
					hookId: "hook1",
					event: "PreToolUse",
					command: "echo hook1",
					cwd: "/project",
					executionId: expect.stringContaining("base"),
				}),
			)

			expect(terminalEvt).toEqual(
				expect.objectContaining({
					phase: "completed",
					hookId: "hook1",
					event: "PreToolUse",
					executionId: startedEvt.executionId,
					outputSummary: "outerr",
					exitCode: 0,
					durationMs: 100,
				}),
			)

			compressSpy.mockRestore()
		})

		it("should execute hooks sequentially", async () => {
			const hook1 = createMockHook("hook1")
			const hook2 = createMockHook("hook2")
			const snapshot = createMockSnapshot([hook1, hook2])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1, hook2])
			mockExecuteHook.mockResolvedValue({
				hook: hook1,
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 100,
				timedOut: false,
			})
			mockInterpretResult.mockReturnValue({
				success: true,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			const result = await manager.executeHooks("PreToolUse", { context: createMockContext() })

			// Should execute both hooks
			expect(mockExecuteHook).toHaveBeenCalledTimes(2)
			expect(result.results).toHaveLength(2)
			expect(result.blocked).toBe(false)
		})

		it("should stop execution when a hook blocks", async () => {
			const hook1 = createMockHook("blocker")
			const hook2 = createMockHook("after-block")
			const snapshot = createMockSnapshot([hook1, hook2])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1, hook2])
			mockExecuteHook.mockResolvedValue({
				hook: hook1,
				exitCode: 2,
				stdout: "",
				stderr: "Blocked!",
				duration: 100,
				timedOut: false,
			})
			mockInterpretResult.mockReturnValue({
				success: false,
				blocked: true,
				blockMessage: "Blocked!",
				shouldContinue: false,
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			const result = await manager.executeHooks("PreToolUse", { context: createMockContext() })

			// Should only execute first hook (the blocker)
			expect(mockExecuteHook).toHaveBeenCalledTimes(1)
			expect(result.results).toHaveLength(1)
			expect(result.blocked).toBe(true)
			expect(result.blockMessage).toBe("Blocked!")
		})

		it("should continue on non-blocking failures", async () => {
			const hook1 = createMockHook("failing")
			const hook2 = createMockHook("after-fail")
			const snapshot = createMockSnapshot([hook1, hook2])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1, hook2])

			let callCount = 0
			mockExecuteHook.mockImplementation(async (hook) => ({
				hook,
				exitCode: callCount++ === 0 ? 1 : 0,
				stdout: "",
				stderr: callCount === 1 ? "Error" : "",
				duration: 100,
				timedOut: false,
			}))
			mockInterpretResult.mockImplementation((result) => ({
				success: result.exitCode === 0,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			}))

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			const result = await manager.executeHooks("PreToolUse", { context: createMockContext() })

			// Should execute both hooks despite first failure
			expect(mockExecuteHook).toHaveBeenCalledTimes(2)
			expect(result.results).toHaveLength(2)
			expect(result.blocked).toBe(false)
		})

		it("should return first modification only", async () => {
			const hook1 = createMockHook("modifier1")
			const hook2 = createMockHook("modifier2")
			const snapshot = createMockSnapshot([hook1, hook2])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1, hook2])

			let callCount = 0
			mockExecuteHook.mockImplementation(async (hook) => ({
				hook,
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 100,
				timedOut: false,
				modification:
					callCount++ === 0
						? { action: "modify" as const, toolInput: { from: "first" } }
						: { action: "modify" as const, toolInput: { from: "second" } },
			}))
			mockInterpretResult.mockReturnValue({
				success: true,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			const result = await manager.executeHooks("PreToolUse", { context: createMockContext() })

			expect(result.modification?.toolInput).toEqual({ from: "first" })
		})

		it("should auto-load config if not loaded", async () => {
			const hook1 = createMockHook("hook1")
			const snapshot = createMockSnapshot([hook1])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1])
			mockExecuteHook.mockResolvedValue({
				hook: hook1,
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 100,
				timedOut: false,
			})
			mockInterpretResult.mockReturnValue({
				success: true,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			})

			const manager = createHookManager({ cwd: "/project" })
			// Don't call loadHooksConfig explicitly

			await manager.executeHooks("PreToolUse", { context: createMockContext() })

			// Should have auto-loaded
			expect(mockLoadHooksConfig).toHaveBeenCalled()
		})
	})

	describe("getEnabledHooks", () => {
		it("should return all enabled hooks", async () => {
			const hook1 = createMockHook("hook1")
			const hook2 = createMockHook("hook2")
			const disabledHook = { ...createMockHook("disabled"), enabled: false } as ResolvedHook
			const snapshot = createMockSnapshot([hook1, hook2, disabledHook])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			const enabled = manager.getEnabledHooks()

			expect(enabled).toHaveLength(2)
			expect(enabled.map((h) => h.id).sort()).toEqual(["hook1", "hook2"])
		})

		it("should exclude runtime-disabled hooks", async () => {
			const hook1 = createMockHook("hook1")
			const hook2 = createMockHook("hook2")
			const snapshot = createMockSnapshot([hook1, hook2])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			await manager.setHookEnabled("hook2", false)

			const enabled = manager.getEnabledHooks()

			expect(enabled).toHaveLength(1)
			expect(enabled[0].id).toBe("hook1")
		})
	})

	describe("setHookEnabled", () => {
		it("should disable a hook", async () => {
			const hook1 = createMockHook("hook1")
			const snapshot = createMockSnapshot([hook1])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			await manager.setHookEnabled("hook1", false)

			expect(manager.getConfigSnapshot()?.disabledHookIds.has("hook1")).toBe(true)
		})

		it("should re-enable a disabled hook", async () => {
			const hook1 = createMockHook("hook1")
			const snapshot = createMockSnapshot([hook1])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			await manager.setHookEnabled("hook1", false)
			await manager.setHookEnabled("hook1", true)

			expect(manager.getConfigSnapshot()?.disabledHookIds.has("hook1")).toBe(false)
		})

		it("should throw for non-existent hook", async () => {
			const snapshot = createMockSnapshot([])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			await expect(manager.setHookEnabled("nonexistent", false)).rejects.toThrow("Hook not found")
		})
	})

	describe("getHookExecutionHistory", () => {
		it("should return execution history", async () => {
			const hook1 = createMockHook("hook1")
			const snapshot = createMockSnapshot([hook1])

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue([hook1])
			mockExecuteHook.mockResolvedValue({
				hook: hook1,
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 100,
				timedOut: false,
			})
			mockInterpretResult.mockReturnValue({
				success: true,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			})

			const manager = createHookManager({ cwd: "/project" })
			await manager.loadHooksConfig()

			await manager.executeHooks("PreToolUse", {
				context: {
					event: "PreToolUse",
					timestamp: "2026-01-16T12:00:00Z",
					session: { taskId: "task_1", sessionId: "session_1", mode: "code" },
					project: { directory: "/project", name: "test" },
				},
			})

			const history = manager.getHookExecutionHistory()

			expect(history).toHaveLength(1)
			expect(history[0].hook.id).toBe("hook1")
			expect(history[0].event).toBe("PreToolUse")
		})

		it("should limit history size", async () => {
			const hooks = Array.from({ length: 150 }, (_, i) => createMockHook(`hook${i}`))
			const snapshot = createMockSnapshot(hooks)

			mockLoadHooksConfig.mockResolvedValue({
				snapshot,
				errors: [],
				warnings: [],
			})
			mockGetHooksForEvent.mockReturnValue(hooks)
			mockExecuteHook.mockImplementation(async (hook) => ({
				hook,
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 10,
				timedOut: false,
			}))
			mockInterpretResult.mockReturnValue({
				success: true,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			})

			const manager = createHookManager({ cwd: "/project", maxHistoryEntries: 100 })
			await manager.loadHooksConfig()

			await manager.executeHooks("PreToolUse", {
				context: {
					event: "PreToolUse",
					timestamp: "2026-01-16T12:00:00Z",
					session: { taskId: "task_1", sessionId: "session_1", mode: "code" },
					project: { directory: "/project", name: "test" },
				},
			})

			const history = manager.getHookExecutionHistory()

			expect(history.length).toBeLessThanOrEqual(100)
		})
	})

	describe("createHookManager", () => {
		it("should create a HookManager instance", () => {
			const manager = createHookManager({ cwd: "/project" })
			expect(manager).toBeInstanceOf(HookManager)
		})
	})
})
