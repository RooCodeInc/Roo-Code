import * as vscode from "vscode"
import { TerminalRegistry } from "../TerminalRegistry"
import { Terminal } from "../Terminal"
import { TerminalProcess } from "../TerminalProcess"

// Mock vscode module
vi.mock("vscode", () => {
	const eventHandlers: any = {
		startTerminalShellExecution: null,
		endTerminalShellExecution: null,
		closeTerminal: null,
	}

	return {
		workspace: {
			getConfiguration: vi.fn().mockReturnValue({
				get: vi.fn().mockReturnValue(null),
			}),
		},
		window: {
			createTerminal: vi.fn().mockImplementation(() => ({
				shellIntegration: undefined,
				exitStatus: undefined,
				show: vi.fn(),
				sendText: vi.fn(),
				dispose: vi.fn(),
			})),
			onDidStartTerminalShellExecution: vi.fn().mockImplementation((handler) => {
				eventHandlers.startTerminalShellExecution = handler
				return { dispose: vi.fn() }
			}),
			onDidEndTerminalShellExecution: vi.fn().mockImplementation((handler) => {
				eventHandlers.endTerminalShellExecution = handler
				return { dispose: vi.fn() }
			}),
			onDidCloseTerminal: vi.fn().mockImplementation((handler) => {
				eventHandlers.closeTerminal = handler
				return { dispose: vi.fn() }
			}),
		},
		ThemeIcon: class ThemeIcon {
			constructor(public id: string) {}
		},
		Uri: {
			file: (path: string) => ({ fsPath: path }),
		},
		__eventHandlers: eventHandlers,
	}
})

describe("TerminalRegistry race condition handling", () => {
	let mockTerminal: any
	let mockTerminalInfo: Terminal
	let terminalProcess: TerminalProcess

	beforeAll(() => {
		TerminalRegistry.initialize()
	})

	beforeEach(() => {
		// Clear terminals
		TerminalRegistry["terminals"] = []
		vi.clearAllMocks()

		// Create mock VSCode terminal
		mockTerminal = {
			shellIntegration: {
				executeCommand: vi.fn(),
				cwd: vscode.Uri.file("/test/path"),
			},
			name: "Roo Code",
			processId: Promise.resolve(123),
			creationOptions: {},
			exitStatus: undefined,
			state: { isInteractedWith: true },
			dispose: vi.fn(),
			hide: vi.fn(),
			show: vi.fn(),
			sendText: vi.fn(),
		}

		// Create Terminal instance
		mockTerminalInfo = new Terminal(1, mockTerminal, "/test/path")
		TerminalRegistry["terminals"] = [mockTerminalInfo]

		// Create TerminalProcess
		terminalProcess = new TerminalProcess(mockTerminalInfo)
		terminalProcess.command = "cd test && echo hello"
		mockTerminalInfo.process = terminalProcess
	})

	it("should handle end event arriving before start event (race condition)", async () => {
		const eventHandlers = (vscode as any).__eventHandlers
		const completedSpy = vi.fn()
		const shellExecutionCompleteSpy = vi.fn()

		// Set up listeners
		terminalProcess.once("completed", completedSpy)
		terminalProcess.once("shell_execution_complete", shellExecutionCompleteSpy)

		// Simulate the race condition: end event fires BEFORE start event
		// This simulates a fast-completing first command in a compound command

		// 1. First, fire the END event (before terminal is marked as running)
		expect(mockTerminalInfo.running).toBe(false)

		if (eventHandlers.endTerminalShellExecution) {
			eventHandlers.endTerminalShellExecution({
				terminal: mockTerminal,
				exitCode: 0,
				execution: {
					commandLine: { value: "cd test && echo hello" },
				},
			})
		}

		// Verify that the process still received the completion signal despite the race
		await new Promise((resolve) => setTimeout(resolve, 10))

		// The fix should have called shellExecutionComplete even though running was false
		expect(shellExecutionCompleteSpy).toHaveBeenCalledWith({ exitCode: 0 })
		expect(mockTerminalInfo.busy).toBe(false)

		// 2. Now fire the START event (after end already happened)
		const mockStream = (async function* () {
			yield "\x1b]633;C\x07"
			yield "hello\n"
			yield "\x1b]633;D\x07"
		})()

		if (eventHandlers.startTerminalShellExecution) {
			eventHandlers.startTerminalShellExecution({
				terminal: mockTerminal,
				execution: {
					commandLine: { value: "cd test && echo hello" },
					read: () => mockStream,
				},
			})
		}

		// Terminal should handle this gracefully without errors
		expect(mockTerminalInfo.busy).toBe(true)
	})

	it("should properly log warning for race condition instead of error", async () => {
		const eventHandlers = (vscode as any).__eventHandlers
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Fire end event before start (race condition)
		if (eventHandlers.endTerminalShellExecution) {
			eventHandlers.endTerminalShellExecution({
				terminal: mockTerminal,
				exitCode: 0,
				execution: {
					commandLine: { value: "cd test && echo hello" },
				},
			})
		}

		// Should log warning, not error, for the race condition
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"[TerminalRegistry] Shell execution end event received before terminal marked as running (race condition)",
			),
			expect.any(Object),
		)
		expect(errorSpy).not.toHaveBeenCalledWith(
			expect.stringContaining("Shell execution end event received, but process is not running for terminal"),
			expect.any(Object),
		)

		warnSpy.mockRestore()
		errorSpy.mockRestore()
	})

	it("should still error when no process exists", async () => {
		const eventHandlers = (vscode as any).__eventHandlers
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Remove the process
		mockTerminalInfo.process = undefined

		// Fire end event without a process
		if (eventHandlers.endTerminalShellExecution) {
			eventHandlers.endTerminalShellExecution({
				terminal: mockTerminal,
				exitCode: 0,
				execution: {
					commandLine: { value: "some command" },
				},
			})
		}

		// Should still error when there's truly no process
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"[TerminalRegistry] Shell execution end event received, but process is not running and no process exists",
			),
			expect.any(Object),
		)

		errorSpy.mockRestore()
	})
})
