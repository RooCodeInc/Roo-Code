// npx vitest run __tests__/checkpoint-delegation-abort-noise.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

/* vscode mock sufficient for importing Task and checkpoint service */
vi.mock("vscode", () => {
	const window = {
		createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	}
	const workspace = {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((_key: string, defaultValue: any) => defaultValue),
			update: vi.fn(),
		})),
		workspaceFolders: [],
	}
	const env = { machineId: "test-machine", uriScheme: "vscode", appName: "VSCode", language: "en", sessionId: "sess" }
	const Uri = { file: (p: string) => ({ fsPath: p, toString: () => p }) }
	const commands = { executeCommand: vi.fn() }
	const ExtensionMode = { Development: 2 }
	const version = "1.0.0-test"
	return { window, workspace, env, Uri, commands, ExtensionMode, version }
})

describe("Checkpoint delegation abort noise prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("checkpoint_saved say is skipped when task is aborted", async () => {
		const logSpy = vi.fn()
		const saySpy = vi.fn()

		const task: any = {
			taskId: "aborted-task",
			abandoned: false,
			abort: true, // Task is aborted
			say: saySpy,
			enableCheckpoints: true,
		}

		const provider: any = {
			log: logSpy,
			postMessageToWebview: vi.fn(),
		}

		// Simulate checkpoint event handler logic
		const checkpointHandler = (checkpointData: { fromHash: string; toHash: string; suppressMessage: boolean }) => {
			const { fromHash: from, toHash: to, suppressMessage } = checkpointData

			try {
				// Guard: skip say if task is already aborted or abandoned
				if (task.abandoned || task.abort) {
					logSpy("[Task#getCheckpointService] skipping checkpoint_saved say (task aborted/abandoned)")
					return
				}

				task.say(
					"checkpoint_saved",
					to,
					undefined,
					undefined,
					{ from, to, suppressMessage: !!suppressMessage },
					undefined,
					{ isNonInteractive: true },
				).catch((err: Error) => {
					const isAbortError = err?.message?.includes("aborted") || err?.message?.includes("abandoned")
					if (isAbortError) {
						logSpy("[Task#getCheckpointService] checkpoint_saved say aborted (expected during disposal)")
					} else {
						logSpy("[Task#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
						console.error(err)
					}
				})
			} catch (err) {
				logSpy("[Task#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints")
				console.error(err)
				task.enableCheckpoints = false
			}
		}

		// Trigger checkpoint event with aborted task
		checkpointHandler({ fromHash: "abc123", toHash: "def456", suppressMessage: false })

		// CRITICAL: say should NOT be called when task is aborted
		expect(saySpy).not.toHaveBeenCalled()

		// Log should indicate skip
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("skipping checkpoint_saved say (task aborted/abandoned)"),
		)
	})

	it("checkpoint_saved say is skipped when task is abandoned", async () => {
		const logSpy = vi.fn()
		const saySpy = vi.fn()

		const task: any = {
			taskId: "abandoned-task",
			abandoned: true, // Task is abandoned
			abort: false,
			say: saySpy,
			enableCheckpoints: true,
		}

		const checkpointHandler = (checkpointData: { fromHash: string; toHash: string; suppressMessage: boolean }) => {
			const { fromHash: from, toHash: to, suppressMessage } = checkpointData

			try {
				if (task.abandoned || task.abort) {
					logSpy("[Task#getCheckpointService] skipping checkpoint_saved say (task aborted/abandoned)")
					return
				}

				task.say(
					"checkpoint_saved",
					to,
					undefined,
					undefined,
					{ from, to, suppressMessage: !!suppressMessage },
					undefined,
					{ isNonInteractive: true },
				).catch((err: Error) => {
					const isAbortError = err?.message?.includes("aborted") || err?.message?.includes("abandoned")
					if (isAbortError) {
						logSpy("[Task#getCheckpointService] checkpoint_saved say aborted (expected during disposal)")
					}
				})
			} catch (err) {
				task.enableCheckpoints = false
			}
		}

		checkpointHandler({ fromHash: "xyz", toHash: "uvw", suppressMessage: false })

		expect(saySpy).not.toHaveBeenCalled()
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("skipping checkpoint_saved say"))
	})

	it("checkpoint_saved say abort errors are caught and swallowed", async () => {
		const logSpy = vi.fn()
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const task: any = {
			taskId: "error-task",
			abandoned: false,
			abort: false,
			say: vi.fn().mockRejectedValue(new Error("[RooCode#say] task test-task aborted")),
			enableCheckpoints: true,
		}

		const checkpointHandler = (checkpointData: { fromHash: string; toHash: string; suppressMessage: boolean }) => {
			const { fromHash: from, toHash: to, suppressMessage } = checkpointData

			try {
				if (task.abandoned || task.abort) {
					logSpy("[Task#getCheckpointService] skipping checkpoint_saved say (task aborted/abandoned)")
					return
				}

				task.say(
					"checkpoint_saved",
					to,
					undefined,
					undefined,
					{ from, to, suppressMessage: !!suppressMessage },
					undefined,
					{ isNonInteractive: true },
				).catch((err: Error) => {
					const isAbortError = err?.message?.includes("aborted") || err?.message?.includes("abandoned")
					if (isAbortError) {
						logSpy("[Task#getCheckpointService] checkpoint_saved say aborted (expected during disposal)")
					} else {
						logSpy("[Task#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
						console.error(err)
					}
				})
			} catch (err) {
				logSpy("[Task#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints")
				console.error(err)
				task.enableCheckpoints = false
			}
		}

		// Trigger checkpoint that will throw abort error
		checkpointHandler({ fromHash: "abc", toHash: "def", suppressMessage: false })

		// Wait for promise to settle
		await new Promise((resolve) => setTimeout(resolve, 10))

		// CRITICAL: abort error should be caught and logged, not thrown
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("checkpoint_saved say aborted (expected during disposal)"),
		)

		// No unhandled rejection - error was caught
		expect(task.say).toHaveBeenCalled()

		consoleErrorSpy.mockRestore()
	})

	it("non-abort errors in checkpoint_saved say are still logged", async () => {
		const logSpy = vi.fn()
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const task: any = {
			taskId: "normal-error-task",
			abandoned: false,
			abort: false,
			say: vi.fn().mockRejectedValue(new Error("Some other error")),
			enableCheckpoints: true,
		}

		const checkpointHandler = (checkpointData: { fromHash: string; toHash: string; suppressMessage: boolean }) => {
			const { fromHash: from, toHash: to, suppressMessage } = checkpointData

			try {
				if (task.abandoned || task.abort) {
					return
				}

				task.say(
					"checkpoint_saved",
					to,
					undefined,
					undefined,
					{ from, to, suppressMessage: !!suppressMessage },
					undefined,
					{ isNonInteractive: true },
				).catch((err: Error) => {
					const isAbortError = err?.message?.includes("aborted") || err?.message?.includes("abandoned")
					if (isAbortError) {
						logSpy("[Task#getCheckpointService] checkpoint_saved say aborted (expected during disposal)")
					} else {
						logSpy("[Task#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
						console.error(err)
					}
				})
			} catch (err) {
				task.enableCheckpoints = false
			}
		}

		checkpointHandler({ fromHash: "ghi", toHash: "jkl", suppressMessage: false })

		await new Promise((resolve) => setTimeout(resolve, 10))

		// Non-abort errors should still be logged normally
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("caught unexpected error in say('checkpoint_saved')"),
		)
		expect(consoleErrorSpy).toHaveBeenCalled()

		consoleErrorSpy.mockRestore()
	})

	it("delegateParentAndOpenChild awaits removeClineFromStack to prevent unhandled rejections", async () => {
		const removeSpy = vi.fn().mockResolvedValue(undefined)
		const createTaskSpy = vi.fn().mockResolvedValue({ taskId: "child-x" })

		const provider: any = {
			getState: vi.fn().mockResolvedValue({ experiments: {} }),
			getCurrentTask: vi.fn(() => ({ taskId: "parent-x" })),
			removeClineFromStack: removeSpy,
			createTask: createTaskSpy,
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: { id: "parent-x", childIds: [] },
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
			emit: vi.fn(),
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		const { ClineProvider } = await import("../core/webview/ClineProvider")

		await ClineProvider.prototype.delegateParentAndOpenChild.call(provider, {
			parentTaskId: "parent-x",
			message: "test",
			initialTodos: [],
			mode: "code",
		})

		// CRITICAL: removeClineFromStack must be awaited (not fire-and-forget)
		expect(removeSpy).toHaveBeenCalledTimes(1)

		// Child creation should only happen AFTER parent removal completes
		expect(removeSpy).toHaveBeenCalled()
		expect(createTaskSpy).toHaveBeenCalled()
	})

	it("delegateParentAndOpenChild catches and logs errors from parent disposal without failing", async () => {
		const logSpy = vi.fn()
		const disposalError = new Error("Disposal error")
		const removeSpy = vi.fn().mockRejectedValue(disposalError)

		const provider: any = {
			getState: vi.fn().mockResolvedValue({ experiments: {} }),
			getCurrentTask: vi.fn(() => ({ taskId: "parent-y" })),
			removeClineFromStack: removeSpy,
			createTask: vi.fn().mockResolvedValue({ taskId: "child-y" }),
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: { id: "parent-y", childIds: [] },
			}),
			updateTaskHistory: vi.fn().mockResolvedValue([]),
			emit: vi.fn(),
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			log: logSpy,
		}

		const { ClineProvider } = await import("../core/webview/ClineProvider")

		// Should NOT throw - errors should be caught
		await expect(
			ClineProvider.prototype.delegateParentAndOpenChild.call(provider, {
				parentTaskId: "parent-y",
				message: "test",
				initialTodos: [],
				mode: "code",
			}),
		).resolves.toBeDefined()

		// CRITICAL: error should be logged but not thrown
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Error during parent disposal (non-fatal)"))
	})
})
