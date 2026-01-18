/**
 * Tests for HookExecutor
 *
 * Covers:
 * - Exit code handling (0=success, 2=block, other=error)
 * - Timeout behavior
 * - Environment variable setup
 * - stdin JSON payload
 * - Blocking vs non-blocking events
 */

import { spawn } from "child_process"
import { executeHook, interpretResult, describeResult } from "../HookExecutor"
import type { ResolvedHook, HookContext, HookExecutionResult, HookEventType } from "../types"

// Mock child_process
vi.mock("child_process", () => ({
	spawn: vi.fn(),
}))

const mockSpawn = vi.mocked(spawn)

describe("HookExecutor", () => {
	const createMockHook = (overrides: Partial<ResolvedHook> = {}): ResolvedHook =>
		({
			id: "test-hook",
			matcher: "*",
			enabled: true,
			command: "echo test",
			timeout: 5,
			source: "project",
			event: "PreToolUse" as HookEventType,
			filePath: "/test/hooks.yaml",
			includeConversationHistory: false,
			...overrides,
		}) as ResolvedHook

	const createMockContext = (overrides: Partial<HookContext> = {}): HookContext => ({
		event: "PreToolUse",
		timestamp: "2026-01-16T12:00:00Z",
		session: {
			taskId: "task_123",
			sessionId: "session_456",
			mode: "code",
		},
		project: {
			directory: "/project",
			name: "test-project",
		},
		tool: {
			name: "Write",
			input: { filePath: "/src/index.ts", content: "// test" },
		},
		...overrides,
	})

	describe("interpretResult", () => {
		it("should interpret exit code 0 as success", () => {
			const result: HookExecutionResult = {
				hook: createMockHook(),
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 100,
				timedOut: false,
			}

			const interpretation = interpretResult(result)

			expect(interpretation.success).toBe(true)
			expect(interpretation.blocked).toBe(false)
			expect(interpretation.shouldContinue).toBe(true)
		})

		it("should interpret exit code 2 as block for blocking events", () => {
			const result: HookExecutionResult = {
				hook: createMockHook({ event: "PreToolUse" }),
				exitCode: 2,
				stdout: "",
				stderr: "Lint errors found",
				duration: 100,
				timedOut: false,
			}

			const interpretation = interpretResult(result)

			expect(interpretation.success).toBe(false)
			expect(interpretation.blocked).toBe(true)
			expect(interpretation.blockMessage).toBe("Lint errors found")
			expect(interpretation.shouldContinue).toBe(false)
		})

		it("should NOT block for non-blocking events even with exit code 2", () => {
			const result: HookExecutionResult = {
				hook: createMockHook({ event: "PostToolUse" }),
				exitCode: 2,
				stdout: "",
				stderr: "Some error",
				duration: 100,
				timedOut: false,
			}

			const interpretation = interpretResult(result)

			expect(interpretation.blocked).toBe(false)
			expect(interpretation.shouldContinue).toBe(true)
		})

		it("should interpret other non-zero codes as error (continue)", () => {
			const result: HookExecutionResult = {
				hook: createMockHook(),
				exitCode: 1,
				stdout: "",
				stderr: "Command failed",
				duration: 100,
				timedOut: false,
			}

			const interpretation = interpretResult(result)

			expect(interpretation.success).toBe(false)
			expect(interpretation.blocked).toBe(false)
			expect(interpretation.shouldContinue).toBe(true)
		})

		it("should handle timeout (continue)", () => {
			const result: HookExecutionResult = {
				hook: createMockHook(),
				exitCode: null,
				stdout: "",
				stderr: "",
				duration: 5000,
				timedOut: true,
			}

			const interpretation = interpretResult(result)

			expect(interpretation.success).toBe(false)
			expect(interpretation.blocked).toBe(false)
			expect(interpretation.shouldContinue).toBe(true)
		})

		it("should handle execution error (continue)", () => {
			const result: HookExecutionResult = {
				hook: createMockHook(),
				exitCode: null,
				stdout: "",
				stderr: "",
				duration: 10,
				timedOut: false,
				error: new Error("Command not found"),
			}

			const interpretation = interpretResult(result)

			expect(interpretation.success).toBe(false)
			expect(interpretation.blocked).toBe(false)
			expect(interpretation.shouldContinue).toBe(true)
		})

		describe("blocking events", () => {
			const blockingEvents: HookEventType[] = [
				"PreToolUse",
				"PermissionRequest",
				"UserPromptSubmit",
				"Stop",
				"SubagentStop",
			]

			for (const event of blockingEvents) {
				it(`should allow blocking for ${event}`, () => {
					const result: HookExecutionResult = {
						hook: createMockHook({ event }),
						exitCode: 2,
						stdout: "",
						stderr: "Blocked",
						duration: 100,
						timedOut: false,
					}

					const interpretation = interpretResult(result)
					expect(interpretation.blocked).toBe(true)
				})
			}
		})

		describe("non-blocking events", () => {
			const nonBlockingEvents: HookEventType[] = [
				"PostToolUse",
				"PostToolUseFailure",
				"SubagentStart",
				"SessionStart",
				"SessionEnd",
				"Notification",
				"PreCompact",
			]

			for (const event of nonBlockingEvents) {
				it(`should NOT block for ${event}`, () => {
					const result: HookExecutionResult = {
						hook: createMockHook({ event }),
						exitCode: 2,
						stdout: "",
						stderr: "Attempted block",
						duration: 100,
						timedOut: false,
					}

					const interpretation = interpretResult(result)
					expect(interpretation.blocked).toBe(false)
				})
			}
		})
	})

	describe("describeResult", () => {
		it("should describe successful execution", () => {
			const result: HookExecutionResult = {
				hook: createMockHook({ id: "my-hook" }),
				exitCode: 0,
				stdout: "",
				stderr: "",
				duration: 150,
				timedOut: false,
			}

			const description = describeResult(result)

			expect(description).toContain("my-hook")
			expect(description).toContain("successfully")
			expect(description).toContain("150ms")
		})

		it("should describe blocked execution", () => {
			const result: HookExecutionResult = {
				hook: createMockHook({ id: "blocker" }),
				exitCode: 2,
				stdout: "",
				stderr: "Policy violation",
				duration: 100,
				timedOut: false,
			}

			const description = describeResult(result)

			expect(description).toContain("blocker")
			expect(description).toContain("blocked")
			expect(description).toContain("Policy violation")
		})

		it("should describe timeout", () => {
			const result: HookExecutionResult = {
				hook: createMockHook({ id: "slow-hook", timeout: 30 }),
				exitCode: null,
				stdout: "",
				stderr: "",
				duration: 30000,
				timedOut: true,
			}

			const description = describeResult(result)

			expect(description).toContain("slow-hook")
			expect(description).toContain("timed out")
			expect(description).toContain("30")
		})

		it("should describe execution error", () => {
			const result: HookExecutionResult = {
				hook: createMockHook({ id: "broken" }),
				exitCode: null,
				stdout: "",
				stderr: "",
				duration: 10,
				timedOut: false,
				error: new Error("Command not found: badcmd"),
			}

			const description = describeResult(result)

			expect(description).toContain("broken")
			expect(description).toContain("failed")
			expect(description).toContain("Command not found")
		})
	})

	describe("executeHook", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should spawn process with correct arguments", async () => {
			const mockProcess = {
				stdin: { write: vi.fn(), end: vi.fn() },
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => cb(0), 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const hook = createMockHook({ command: "./test-script.sh" })
			const context = createMockContext()

			const resultPromise = executeHook(hook, context)

			// Wait a tick for the spawn to be called
			await new Promise((r) => setTimeout(r, 0))

			expect(mockSpawn).toHaveBeenCalled()
			const [shell, args, options] = mockSpawn.mock.calls[0]

			// Should use shell with -c flag (or PowerShell equivalent)
			expect(args[args.length - 1]).toBe("./test-script.sh")
			expect(options.cwd).toBe("/project")

			const result = await resultPromise
			expect(result.exitCode).toBe(0)
		})

		it("should write JSON context to stdin", async () => {
			const stdinWrite = vi.fn()
			const mockProcess = {
				stdin: { write: stdinWrite, end: vi.fn() },
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => cb(0), 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const hook = createMockHook()
			const context = createMockContext()

			await executeHook(hook, context)

			expect(stdinWrite).toHaveBeenCalled()
			const jsonPayload = stdinWrite.mock.calls[0][0]
			const parsed = JSON.parse(jsonPayload)

			expect(parsed.event).toBe("PreToolUse")
			expect(parsed.session.taskId).toBe("task_123")
			expect(parsed.project.directory).toBe("/project")
			expect(parsed.tool.name).toBe("Write")
		})

		it("should set environment variables", async () => {
			const mockProcess = {
				stdin: { write: vi.fn(), end: vi.fn() },
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => cb(0), 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const hook = createMockHook({ id: "env-test" })
			const context = createMockContext()

			await executeHook(hook, context)

			const options = mockSpawn.mock.calls[0][2]
			const env = options.env

			expect(env).toBeDefined()
			if (!env) throw new Error("Expected env to be captured")

			expect(env.ROO_PROJECT_DIR).toBe("/project")
			expect(env.ROO_TASK_ID).toBe("task_123")
			expect(env.ROO_SESSION_ID).toBe("session_456")
			expect(env.ROO_MODE).toBe("code")
			expect(env.ROO_TOOL_NAME).toBe("Write")
			expect(env.ROO_EVENT).toBe("PreToolUse")
			expect(env.ROO_HOOK_ID).toBe("env-test")
		})

		it("should NOT include conversation history by default", async () => {
			const stdinWrite = vi.fn()
			const mockProcess = {
				stdin: { write: stdinWrite, end: vi.fn() },
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => cb(0), 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const hook = createMockHook({ includeConversationHistory: false })
			const context = createMockContext()
			const history = [{ role: "user" as const, content: "Hello" }]

			await executeHook(hook, context, history)

			const jsonPayload = stdinWrite.mock.calls[0][0]
			const parsed = JSON.parse(jsonPayload)

			expect(parsed.conversationHistory).toBeUndefined()
		})

		it("should include conversation history when opted in", async () => {
			const stdinWrite = vi.fn()
			const mockProcess = {
				stdin: { write: stdinWrite, end: vi.fn() },
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => cb(0), 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const hook = createMockHook({ includeConversationHistory: true })
			const context = createMockContext()
			const history = [{ role: "user" as const, content: "Hello" }]

			await executeHook(hook, context, history)

			const jsonPayload = stdinWrite.mock.calls[0][0]
			const parsed = JSON.parse(jsonPayload)

			expect(parsed.conversationHistory).toBeDefined()
			expect(parsed.conversationHistory).toHaveLength(1)
		})

		it("should capture stdout and stderr", async () => {
			let stdoutCallback: ((data: Buffer) => void) | undefined
			let stderrCallback: ((data: Buffer) => void) | undefined

			const mockProcess = {
				stdin: { write: vi.fn(), end: vi.fn() },
				stdout: {
					on: vi.fn((event, cb) => {
						if (event === "data") stdoutCallback = cb
					}),
				},
				stderr: {
					on: vi.fn((event, cb) => {
						if (event === "data") stderrCallback = cb
					}),
				},
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => {
							stdoutCallback?.(Buffer.from("stdout content"))
							stderrCallback?.(Buffer.from("stderr content"))
							cb(0)
						}, 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const result = await executeHook(createMockHook(), createMockContext())

			expect(result.stdout).toContain("stdout content")
			expect(result.stderr).toContain("stderr content")
		})

		it("should handle process spawn errors", async () => {
			const mockProcess = {
				stdin: null,
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "error") {
						setTimeout(() => cb(new Error("spawn ENOENT")), 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const result = await executeHook(createMockHook(), createMockContext())

			expect(result.error).toBeDefined()
			expect(result.error?.message).toContain("ENOENT")
		})

		it("should parse modification JSON from stdout for PreToolUse", async () => {
			let stdoutCallback: ((data: Buffer) => void) | undefined

			const modificationJson = JSON.stringify({
				action: "modify",
				toolInput: { filePath: "/modified/path.ts", content: "// modified" },
			})

			const mockProcess = {
				stdin: { write: vi.fn(), end: vi.fn() },
				stdout: {
					on: vi.fn((event, cb) => {
						if (event === "data") stdoutCallback = cb
					}),
				},
				stderr: { on: vi.fn() },
				on: vi.fn((event, cb) => {
					if (event === "close") {
						setTimeout(() => {
							stdoutCallback?.(Buffer.from(modificationJson))
							cb(0)
						}, 10)
					}
				}),
				kill: vi.fn(),
				killed: false,
			}
			mockSpawn.mockReturnValue(mockProcess as any)

			const result = await executeHook(createMockHook({ event: "PreToolUse" }), createMockContext())

			expect(result.modification).toBeDefined()
			expect(result.modification?.action).toBe("modify")
			expect(result.modification?.toolInput.filePath).toBe("/modified/path.ts")
		})
	})
})
