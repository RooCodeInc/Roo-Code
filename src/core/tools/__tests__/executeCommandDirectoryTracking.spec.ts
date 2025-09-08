/**
 * Test for GitHub Issue #7567: Regression: task directory is not followed on terminal requests
 *
 * This test verifies that when a command changes directory (e.g., `cd subdir`),
 * subsequent commands use the terminal's updated working directory instead of
 * spawning a new terminal.
 */

import * as path from "path"
import * as fs from "fs/promises"
import { vi, describe, it, expect, beforeEach } from "vitest"

import { ExecuteCommandOptions, executeCommand } from "../executeCommandTool"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../../integrations/terminal/Terminal"
import type { RooTerminalCallbacks, RooTerminal } from "../../../integrations/terminal/types"

// Mock fs to control directory existence checks
vi.mock("fs/promises")

// Mock TerminalRegistry to control terminal creation
vi.mock("../../../integrations/terminal/TerminalRegistry")

// Mock Terminal class
vi.mock("../../../integrations/terminal/Terminal")

describe("Terminal Directory Tracking (Issue #7567)", () => {
	let mockTask: any
	let mockTerminal: any
	let mockProcess: any
	let mockProvider: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock fs.access to simulate directory existence
		;(fs.access as any).mockResolvedValue(undefined)

		// Create mock provider
		mockProvider = {
			postMessageToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({
				terminalOutputLineLimit: 500,
				terminalShellIntegrationDisabled: false,
			}),
		}

		// Create mock task
		mockTask = {
			cwd: "/test/project",
			taskId: "test-task-123",
			providerRef: {
				deref: vi.fn().mockResolvedValue(mockProvider),
			},
			say: vi.fn().mockResolvedValue(undefined),
			terminalProcess: undefined,
			lastUsedTerminal: undefined, // This is the new property we're testing
		}

		// Create mock process that resolves immediately
		mockProcess = Promise.resolve()
		mockProcess.continue = vi.fn()
		mockProcess.abort = vi.fn()

		// Create mock terminal with getCurrentWorkingDirectory method
		mockTerminal = {
			provider: "vscode",
			id: 1,
			initialCwd: "/test/project",
			getCurrentWorkingDirectory: vi.fn().mockReturnValue("/test/project"),
			isClosed: vi.fn().mockReturnValue(false),
			runCommand: vi.fn().mockReturnValue(mockProcess),
			terminal: {
				show: vi.fn(),
				shellIntegration: {
					cwd: { fsPath: "/test/project" },
				},
			},
		}
	})

	it("should track terminal working directory changes across multiple commands", async () => {
		// Setup: First command will be `cd subdir`
		const initialCwd = "/test/project"
		const subdirCwd = "/test/project/subdir"

		// Mock terminal behavior for first command (cd subdir)
		let currentWorkingDir = initialCwd
		mockTerminal.getCurrentWorkingDirectory.mockImplementation(() => currentWorkingDir)

		// First command execution
		mockTerminal.runCommand.mockImplementationOnce((command: string, callbacks: RooTerminalCallbacks) => {
			// Simulate directory change
			currentWorkingDir = subdirCwd
			mockTerminal.terminal.shellIntegration.cwd.fsPath = subdirCwd

			setTimeout(() => {
				callbacks.onCompleted("", mockProcess)
				callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
			}, 0)
			return mockProcess
		})
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValueOnce(mockTerminal)

		// Execute first command: cd subdir
		const options1: ExecuteCommandOptions = {
			executionId: "test-123",
			command: "cd subdir",
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		const [rejected1, result1] = await executeCommand(mockTask, options1)

		// Verify first command
		expect(rejected1).toBe(false)
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(initialCwd, mockTask.taskId, "vscode")
		expect(mockTask.lastUsedTerminal).toBe(mockTerminal) // Terminal should be stored
		expect(result1).toContain(`within working directory '${subdirCwd}'`)

		// Reset mocks for second command
		vi.mocked(TerminalRegistry.getOrCreateTerminal).mockClear()

		// Second command execution - should use the updated directory
		mockTerminal.runCommand.mockImplementationOnce((command: string, callbacks: RooTerminalCallbacks) => {
			setTimeout(() => {
				callbacks.onCompleted("command_from_subdir output", mockProcess)
				callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
			}, 0)
			return mockProcess
		})
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValueOnce(mockTerminal)

		// Execute second command: command_from_subdir
		const options2: ExecuteCommandOptions = {
			executionId: "test-456",
			command: "command_from_subdir",
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		const [rejected2, result2] = await executeCommand(mockTask, options2)

		// Verify second command uses the subdirectory
		expect(rejected2).toBe(false)
		// IMPORTANT: This should be called with subdirCwd, not initialCwd
		// This is the key assertion - the second command should use the updated directory from the first command
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(subdirCwd, mockTask.taskId, "vscode")
		expect(result2).toContain(`within working directory '${subdirCwd}'`)
	})

	it("should handle relative paths based on terminal's current directory", async () => {
		// Setup: Terminal is in a subdirectory
		const subdirCwd = "/test/project/src"
		mockTask.lastUsedTerminal = mockTerminal
		mockTerminal.getCurrentWorkingDirectory.mockReturnValue(subdirCwd)

		mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
			setTimeout(() => {
				callbacks.onCompleted("Command output", mockProcess)
				callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
			}, 0)
			return mockProcess
		})

		// Create a new mock terminal that will be returned with the resolved path
		const newMockTerminal = {
			...mockTerminal,
			getCurrentWorkingDirectory: vi.fn().mockReturnValue(path.resolve(subdirCwd, "components")),
		}

		const resolvedPath = path.resolve(subdirCwd, "components")
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(newMockTerminal)

		// Execute command with relative custom cwd
		const options: ExecuteCommandOptions = {
			executionId: "test-789",
			command: "ls",
			customCwd: "components", // Relative to terminal's current directory
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify it resolves relative to terminal's cwd, not task's cwd
		expect(rejected).toBe(false)
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(resolvedPath, mockTask.taskId, "vscode")
		expect(result).toContain(`within working directory '${resolvedPath.toPosix()}'`)
	})

	it("should fallback to task cwd when terminal is closed", async () => {
		// Setup: Previous terminal exists but is closed
		mockTask.lastUsedTerminal = mockTerminal
		mockTerminal.isClosed.mockReturnValue(true)

		// Create a new terminal for this test
		const newMockTerminal = {
			...mockTerminal,
			id: 2,
			isClosed: vi.fn().mockReturnValue(false),
		}

		newMockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
			setTimeout(() => {
				callbacks.onCompleted("Command output", mockProcess)
				callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
			}, 0)
			return mockProcess
		})
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(newMockTerminal)

		const options: ExecuteCommandOptions = {
			executionId: "test-999",
			command: "echo test",
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify it falls back to task.cwd when terminal is closed
		expect(rejected).toBe(false)
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(mockTask.cwd, mockTask.taskId, "vscode")
		expect(mockTask.lastUsedTerminal).toBe(newMockTerminal) // Should update to new terminal
	})

	it("should handle sequence of cd commands correctly", async () => {
		// This test simulates: cd dir1 && command1, then cd ../dir2 && command2
		let currentWorkingDir = "/test/project"

		mockTerminal.getCurrentWorkingDirectory.mockImplementation(() => currentWorkingDir)
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)

		// First command: cd dir1 && command1
		mockTerminal.runCommand.mockImplementationOnce((command: string, callbacks: RooTerminalCallbacks) => {
			currentWorkingDir = "/test/project/dir1"
			setTimeout(() => {
				callbacks.onCompleted("", mockProcess)
				callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
			}, 0)
			return mockProcess
		})

		const options1: ExecuteCommandOptions = {
			executionId: "test-seq-1",
			command: "cd dir1 && command1",
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		await executeCommand(mockTask, options1)
		expect(mockTask.lastUsedTerminal).toBe(mockTerminal)

		// Clear mock for next call
		vi.mocked(TerminalRegistry.getOrCreateTerminal).mockClear()

		// Second command: cd ../dir2 && command2
		mockTerminal.runCommand.mockImplementationOnce((command: string, callbacks: RooTerminalCallbacks) => {
			currentWorkingDir = "/test/project/dir2"
			setTimeout(() => {
				callbacks.onCompleted("", mockProcess)
				callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
			}, 0)
			return mockProcess
		})

		const options2: ExecuteCommandOptions = {
			executionId: "test-seq-2",
			command: "cd ../dir2 && command2",
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		const [rejected2, result2] = await executeCommand(mockTask, options2)

		// Should request terminal with dir1 path (from previous command)
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
			"/test/project/dir1",
			mockTask.taskId,
			"vscode",
		)
		// But result should show dir2 (after cd command)
		expect(result2).toContain("within working directory '/test/project/dir2'")
	})
})
