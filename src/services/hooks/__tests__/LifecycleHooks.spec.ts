import { beforeEach, describe, expect, it, vi } from "vitest"

import { LifecycleHooks } from "../LifecycleHooks"
import type { HookContext, HooksConfigSnapshot, HooksExecutionResult, IHookManager } from "../types"

describe("LifecycleHooks", () => {
	let mockHookManager: IHookManager
	let mockGetSessionContext: () => { cwd: string; taskId: string; mode?: string }
	let mockOnHookStatus: ReturnType<typeof vi.fn>
	let lifecycleHooks: LifecycleHooks

	const createMockHookManager = (): IHookManager =>
		({
			loadHooksConfig: vi.fn(),
			reloadHooksConfig: vi.fn(),
			getConfigSnapshot: vi.fn().mockReturnValue({} as HooksConfigSnapshot),
			executeHooks: vi.fn().mockResolvedValue({
				results: [],
				blocked: false,
				totalDuration: 0,
			} as HooksExecutionResult),
			getEnabledHooks: vi.fn().mockReturnValue([]),
			setHookEnabled: vi.fn(),
			updateHook: vi.fn(),
			getHookExecutionHistory: vi.fn().mockReturnValue([]),
		}) as unknown as IHookManager

	beforeEach(() => {
		vi.restoreAllMocks()
		mockHookManager = createMockHookManager()
		mockGetSessionContext = vi.fn().mockReturnValue({
			cwd: "/test/path",
			taskId: "test-task-123",
			mode: "code",
		})
		mockOnHookStatus = vi.fn()

		lifecycleHooks = new LifecycleHooks(mockHookManager, mockGetSessionContext, mockOnHookStatus)
	})

	describe("constructor", () => {
		it("creates instance with required dependencies", () => {
			expect(lifecycleHooks).toBeInstanceOf(LifecycleHooks)
		})
	})

	const getLastExecuteHooksCall = (): {
		event: string
		options: { context: HookContext; executionId?: string; hookExecutionCallback?: unknown }
	} => {
		const calls = vi.mocked(mockHookManager.executeHooks).mock.calls
		expect(calls.length).toBeGreaterThan(0)
		const [event, options] = calls[calls.length - 1]
		return { event, options: options as any }
	}

	describe("executeUserPromptSubmit (blocking)", () => {
		it("calls hookManager.executeHooks with correct event and context (includes prompt)", async () => {
			await lifecycleHooks.executeUserPromptSubmit("test prompt")

			const { event, options } = getLastExecuteHooksCall()
			expect(event).toBe("UserPromptSubmit")
			expect(options.context).toEqual(
				expect.objectContaining({
					event: "UserPromptSubmit",
					session: expect.objectContaining({
						taskId: "test-task-123",
						sessionId: "test-task-123",
						mode: "code",
					}),
					project: expect.objectContaining({
						directory: "/test/path",
						name: "path",
					}),
					prompt: { text: "test prompt" },
				}),
			)
		})

		it("includes images and source in prompt context when provided", async () => {
			await lifecycleHooks.executeUserPromptSubmit("prompt", {
				images: ["/a.png", "/b.png"],
				source: "chat_input",
			})

			const { options } = getLastExecuteHooksCall()
			expect(options.context.prompt).toEqual({
				text: "prompt",
				images: { count: 2, paths: ["/a.png", "/b.png"] },
				source: "chat_input",
			})
		})

		it("returns blocked: true when hook manager indicates blocked", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				blockMessage: "nope",
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeUserPromptSubmit("test")
			expect(result.blocked).toBe(true)
			expect(result.blockMessage).toBe("nope")
		})

		it("returns blocked: false when hooks complete normally", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: false,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeUserPromptSubmit("test")
			expect(result.blocked).toBe(false)
		})
	})

	describe("hooksEnabled gating", () => {
		it("does not execute hooks when disabled", async () => {
			lifecycleHooks.setHooksEnabledGetter(() => false)

			const result = await lifecycleHooks.executeStop()

			expect(result.blocked).toBe(false)
			expect(mockHookManager.executeHooks).not.toHaveBeenCalled()
		})
	})

	describe("executePreCompact", () => {
		it("calls hookManager.executeHooks with 'PreCompact' event and matcher (manual)", async () => {
			await lifecycleHooks.executePreCompact("manual")

			const { event, options } = getLastExecuteHooksCall()
			expect(event).toBe("PreCompact")
			expect(options.context.tool).toEqual({ name: "manual", input: {} })
		})

		it("passes matcher correctly (auto)", async () => {
			await lifecycleHooks.executePreCompact("auto")
			const { options } = getLastExecuteHooksCall()
			expect(options.context.tool).toEqual({ name: "auto", input: {} })
		})

		it("always returns blocked: false even if hook manager reports blocked", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executePreCompact("manual")
			expect(result.blocked).toBe(false)
		})
	})

	describe("executeStop (blocking)", () => {
		it("calls hookManager.executeHooks with 'Stop' event", async () => {
			await lifecycleHooks.executeStop()
			const { event } = getLastExecuteHooksCall()
			expect(event).toBe("Stop")
		})

		it("includes stop payload in context when options are provided", async () => {
			await lifecycleHooks.executeStop({ reason: "timeout", isAbandoned: true })
			const { options } = getLastExecuteHooksCall()
			expect(options.context).toEqual(
				expect.objectContaining({
					stop: { reason: "timeout", isAbandoned: true },
					// legacy field preserved
					reason: "timeout",
				}),
			)
		})

		it("returns blockMessage when blocked", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				blockMessage: "policy",
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeStop()
			expect(result.blocked).toBe(true)
			expect(result.blockMessage).toBe("policy")
		})

		it("returns blocked: true when hook manager indicates blocked", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeStop()
			expect(result.blocked).toBe(true)
		})

		it("returns blocked: false when hooks complete normally", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: false,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeStop()
			expect(result.blocked).toBe(false)
		})
	})

	describe("executeSubagentStart (non-blocking)", () => {
		it("calls hookManager.executeHooks with 'SubagentStart' event", async () => {
			await lifecycleHooks.executeSubagentStart()
			const { event } = getLastExecuteHooksCall()
			expect(event).toBe("SubagentStart")
		})

		it("passes subtask info in context when provided", async () => {
			await lifecycleHooks.executeSubagentStart({ taskId: "subtask-1", mode: "architect" })
			const { options } = getLastExecuteHooksCall()
			expect(options.context).toEqual(
				expect.objectContaining({
					subtask: { taskId: "subtask-1", mode: "architect" },
				}),
			)
		})

		it("includes parent/child context in subagent payload when provided", async () => {
			await lifecycleHooks.executeSubagentStart({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				mode: "code",
			})
			const { options } = getLastExecuteHooksCall()
			expect(options.context.subagent).toEqual({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				mode: "code",
			})
		})

		it("always returns blocked: false even if hook manager reports blocked", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeSubagentStart({ taskId: "subtask-1" })
			expect(result.blocked).toBe(false)
		})
	})

	describe("executeSubagentStop (blocking)", () => {
		it("calls hookManager.executeHooks with 'SubagentStop' event", async () => {
			await lifecycleHooks.executeSubagentStop()
			const { event } = getLastExecuteHooksCall()
			expect(event).toBe("SubagentStop")
		})

		it("returns blocked: true/false based on hook result", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				totalDuration: 1,
			} as HooksExecutionResult)

			const blockedResult = await lifecycleHooks.executeSubagentStop({ taskId: "subtask-1", result: "ok" })
			expect(blockedResult.blocked).toBe(true)

			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: false,
				totalDuration: 1,
			} as HooksExecutionResult)

			const allowedResult = await lifecycleHooks.executeSubagentStop({ taskId: "subtask-1", result: "ok" })
			expect(allowedResult.blocked).toBe(false)
		})

		it("returns blockMessage when blocked", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				blockMessage: "policy",
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeSubagentStop({ taskId: "subtask-1", result: "ok" })
			expect(result.blocked).toBe(true)
			expect(result.blockMessage).toBe("policy")
		})

		it("includes parent/child context and result in subagent payload when provided", async () => {
			await lifecycleHooks.executeSubagentStop({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				mode: "debug",
				result: { ok: true },
			})
			const { options } = getLastExecuteHooksCall()
			expect(options.context.subagent).toEqual({
				parentTaskId: "parent-1",
				childTaskId: "child-1",
				mode: "debug",
				result: { ok: true },
			})
		})
	})

	describe("executeSessionStart", () => {
		it("calls with correct event and passes trigger matcher (startup/resume/clear/compact)", async () => {
			const triggers = ["startup", "resume", "clear", "compact"] as const

			for (const trigger of triggers) {
				vi.mocked(mockHookManager.executeHooks).mockClear()
				await lifecycleHooks.executeSessionStart(trigger)
				const { event, options } = getLastExecuteHooksCall()
				expect(event).toBe("SessionStart")
				expect(options.context.tool).toEqual({ name: trigger, input: {} })
			}
		})

		it("always returns blocked: false (non-blocking)", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeSessionStart("startup")
			expect(result.blocked).toBe(false)
		})

		it("sets session.source to the trigger", async () => {
			await lifecycleHooks.executeSessionStart("resume")
			const { options } = getLastExecuteHooksCall()
			expect(options.context.session).toEqual(
				expect.objectContaining({
					source: "resume",
				}),
			)
		})

		it("uses sayCallback/updateSayCallback to create and update a hook_execution row", async () => {
			await lifecycleHooks.executeSessionStart("startup")
			const { options } = getLastExecuteHooksCall()
			const hookExecutionCallback = options.hookExecutionCallback as any
			expect(hookExecutionCallback).toEqual(expect.any(Function))

			const sayCallback = vi.fn().mockResolvedValue("row-1")
			const updateSayCallback = vi.fn().mockResolvedValue(undefined)

			await hookExecutionCallback({
				phase: "started",
				executionId: "exec-1",
				hookId: "hook-1",
				event: "SessionStart",
				command: "echo hi",
				cwd: "/test/path",
			})

			// no sayCallback set on the instance -> nothing is persisted
			expect(sayCallback).not.toHaveBeenCalled()
			expect(updateSayCallback).not.toHaveBeenCalled()

			// Now execute with callbacks override and verify persisted row behavior.
			await lifecycleHooks.executeSessionStart("startup", { sayCallback, updateSayCallback })
			const { options: options2 } = getLastExecuteHooksCall()
			const cb2 = options2.hookExecutionCallback as any

			await cb2({
				phase: "started",
				executionId: "exec-2",
				hookId: "hook-2",
				event: "SessionStart",
				command: "echo hello",
				cwd: "/test/path",
			})

			expect(sayCallback).toHaveBeenCalledWith(
				"hook_execution",
				expect.stringContaining('"executionId":"exec-2"'),
			)

			await cb2({
				phase: "completed",
				executionId: "exec-2",
				hookId: "hook-2",
				event: "SessionStart",
				command: "echo hello",
				cwd: "/test/path",
				exitCode: 0,
				durationMs: 5,
				outputSummary: "hello",
			})

			expect(updateSayCallback).toHaveBeenCalledWith(
				"hook_execution",
				"row-1",
				expect.stringContaining('"phase":"completed"'),
			)
		})

		it("reuses cached hookExecutionCallback instance when no callbacks override is provided", async () => {
			await lifecycleHooks.executeSessionStart("startup")
			const { options: first } = getLastExecuteHooksCall()
			const cb1 = first.hookExecutionCallback

			await lifecycleHooks.executeSessionStart("startup")
			const { options: second } = getLastExecuteHooksCall()
			const cb2 = second.hookExecutionCallback

			expect(cb1).toBe(cb2)
		})

		it("falls back to using executionId as row id when sayCallback returns void", async () => {
			const sayCallback = vi.fn().mockResolvedValue(undefined)
			const updateSayCallback = vi.fn().mockResolvedValue(undefined)

			await lifecycleHooks.executeSessionStart("startup", { sayCallback, updateSayCallback })
			const { options } = getLastExecuteHooksCall()
			const cb = options.hookExecutionCallback as any

			await cb({
				phase: "started",
				executionId: "exec-void",
				hookId: "hook-1",
				event: "SessionStart",
				command: "echo hi",
				cwd: "/test/path",
			})

			await cb({
				phase: "completed",
				executionId: "exec-void",
				hookId: "hook-1",
				event: "SessionStart",
				command: "echo hi",
				cwd: "/test/path",
				exitCode: 0,
				durationMs: 1,
				outputSummary: "ok",
			})

			expect(updateSayCallback).toHaveBeenCalledWith("hook_execution", "exec-void", expect.any(String))
		})
	})

	describe("executeSessionEnd", () => {
		it("calls hookManager.executeHooks with 'SessionEnd' event", async () => {
			await lifecycleHooks.executeSessionEnd()
			const { event } = getLastExecuteHooksCall()
			expect(event).toBe("SessionEnd")
		})

		it("always returns blocked: false", async () => {
			vi.mocked(mockHookManager.executeHooks).mockResolvedValueOnce({
				results: [],
				blocked: true,
				totalDuration: 1,
			} as HooksExecutionResult)

			const result = await lifecycleHooks.executeSessionEnd()
			expect(result.blocked).toBe(false)
		})

		it("includes endReason in session context when provided", async () => {
			await lifecycleHooks.executeSessionEnd({ endReason: "stack_removed" })
			const { options } = getLastExecuteHooksCall()
			expect(options.context.session).toEqual(
				expect.objectContaining({
					endReason: "stack_removed",
				}),
			)
		})
	})

	describe("executeNotification", () => {
		it("calls with correct event, matcher, and passes notification data in context", async () => {
			await lifecycleHooks.executeNotification("permission_prompt", { message: "hello" })
			const { event, options } = getLastExecuteHooksCall()
			expect(event).toBe("Notification")
			expect(options.context.tool).toEqual({ name: "permission_prompt", input: {} })
			expect(options.context).toEqual(
				expect.objectContaining({
					notification: { type: "permission_prompt", message: "hello" },
				}),
			)
		})

		it("uses title as fallback message when message is not provided", async () => {
			await lifecycleHooks.executeNotification("idle_prompt", { title: "Title Fallback" })
			const { options } = getLastExecuteHooksCall()
			expect(options.context.notification).toEqual({ type: "idle_prompt", message: "Title Fallback" })
		})
	})

	describe("hookExecutionCallback -> onHookStatus", () => {
		it("maps hookExecutionCallback events to onHookStatus", async () => {
			await lifecycleHooks.executeStop()
			const { options } = getLastExecuteHooksCall()
			expect(options.hookExecutionCallback).toEqual(expect.any(Function))

			await (options.hookExecutionCallback as any)({
				phase: "started",
				executionId: "exec-1",
				hookId: "hook-1",
				event: "Stop",
				command: "echo hi",
				cwd: "/test/path",
			})

			expect(mockOnHookStatus).toHaveBeenCalledWith({
				event: "Stop",
				hookId: "hook-1",
				state: "started",
			})
		})
	})

	describe("error handling", () => {
		it("returns blocked: false when hook execution throws and logs error", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			vi.mocked(mockHookManager.executeHooks).mockRejectedValueOnce(new Error("boom"))

			const result = await lifecycleHooks.executeStop()

			expect(result.blocked).toBe(false)
			expect(result.error).toBe("boom")
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[LifecycleHooks] Error executing Stop hooks:",
				expect.any(Error),
			)
		})
	})
})
