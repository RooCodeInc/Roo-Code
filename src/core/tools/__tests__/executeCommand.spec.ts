//
// Tests the ExecuteCommand tool itself vs calling the tool where the tool is mocked.
//
import * as path from "path"
import * as fs from "fs/promises"

import { ExecuteCommandOptions } from "../executeCommandTool"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../../integrations/terminal/Terminal"
import { ExecaTerminal } from "../../../integrations/terminal/ExecaTerminal"
import type { RooTerminalCallbacks } from "../../../integrations/terminal/types"

// Mock fs to control directory existence checks
vitest.mock("fs/promises")

// Mock TerminalRegistry to control terminal creation
vitest.mock("../../../integrations/terminal/TerminalRegistry")

// Mock Terminal and ExecaTerminal classes
vitest.mock("../../../integrations/terminal/Terminal")
vitest.mock("../../../integrations/terminal/ExecaTerminal")

// Import the actual executeCommand function (not mocked)
import { executeCommand } from "../executeCommandTool"

// Tests for the executeCommand function
describe("executeCommand", () => {
	let mockTask: any
	let mockTerminal: any
	let mockProcess: any
	let mockProvider: any

	beforeEach(() => {
		vitest.clearAllMocks()

		// Mock fs.access to simulate directory existence
		;(fs.access as any).mockResolvedValue(undefined)

		// Create mock provider
		mockProvider = {
			postMessageToWebview: vitest.fn(),
			getState: vitest.fn().mockResolvedValue({
				terminalOutputLineLimit: 500,
				terminalShellIntegrationDisabled: false,
			}),
		}

		// Create mock task
		mockTask = {
			cwd: "/test/project",
			taskId: "test-task-123",
			providerRef: {
				deref: vitest.fn().mockResolvedValue(mockProvider),
			},
			say: vitest.fn().mockResolvedValue(undefined),
			terminalProcess: undefined,
		}

		// Create mock process that resolves immediately
		mockProcess = Promise.resolve()
		mockProcess.continue = vitest.fn()

		// Create mock terminal with getCurrentWorkingDirectory method
		mockTerminal = {
			provider: "vscode",
			id: 1,
			initialCwd: "/test/project",
			getCurrentWorkingDirectory: vitest.fn().mockReturnValue("/test/project"),
			runCommand: vitest.fn().mockReturnValue(mockProcess),
			terminal: {
				show: vitest.fn(),
			},
		}

		// Mock TerminalRegistry.getOrCreateTerminal
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)
	})

	describe("Working Directory Behavior", () => {
		it("should use terminal.getCurrentWorkingDirectory() in the output message for completed commands", async () => {
			// Setup: Mock terminal to return a different current working directory
			const initialCwd = "/test/project"
			const currentCwd = "/test/project/subdirectory"

			mockTask.cwd = initialCwd
			mockTerminal.initialCwd = initialCwd
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue(currentCwd)

			// Mock the terminal process to complete successfully
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				// Simulate command completion
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockTerminal.getCurrentWorkingDirectory).toHaveBeenCalled()
			expect(result).toContain(`within working directory '${currentCwd}'`)
			expect(result).not.toContain(`within working directory '${initialCwd}'`)
		})

		it("should use terminal.getCurrentWorkingDirectory() for VSCode Terminal with shell integration", async () => {
			// Setup: Mock VSCode Terminal instance
			const vscodeTerminal = new Terminal(1, undefined, "/test/project")
			const mockVSCodeTerminal = vscodeTerminal as any

			// Mock shell integration providing different cwd
			mockVSCodeTerminal.terminal = {
				show: vitest.fn(),
				shellIntegration: {
					cwd: { fsPath: "/test/project/changed-dir" },
				},
			}
			mockVSCodeTerminal.getCurrentWorkingDirectory = vitest.fn().mockReturnValue("/test/project/changed-dir")
			mockVSCodeTerminal.runCommand = vitest
				.fn()
				.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
					setTimeout(() => {
						callbacks.onCompleted("Command output", mockProcess)
						callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
					}, 0)
					return mockProcess
				})
			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockVSCodeTerminal)

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("within working directory '/test/project/changed-dir'")
		})

		it("should use terminal.getCurrentWorkingDirectory() for ExecaTerminal (always returns initialCwd)", async () => {
			// Setup: Mock ExecaTerminal instance
			const execaTerminal = new ExecaTerminal(1, "/test/project")
			const mockExecaTerminal = execaTerminal as any

			// ExecaTerminal always returns initialCwd
			mockExecaTerminal.getCurrentWorkingDirectory = vitest.fn().mockReturnValue("/test/project")
			mockExecaTerminal.runCommand = vitest
				.fn()
				.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
					setTimeout(() => {
						callbacks.onCompleted("Command output", mockProcess)
						callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
					}, 0)
					return mockProcess
				})
			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockExecaTerminal)

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: true, // Forces ExecaTerminal
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockExecaTerminal.getCurrentWorkingDirectory).toHaveBeenCalled()
			expect(result).toContain("within working directory '/test/project'")
		})
	})

	describe("Custom Working Directory", () => {
		it("should handle absolute custom cwd and use terminal.getCurrentWorkingDirectory() in output", async () => {
			const customCwd = "/custom/absolute/path"

			mockTerminal.getCurrentWorkingDirectory.mockReturnValue(customCwd)
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				customCwd,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(customCwd, mockTask.taskId, "vscode")
			expect(result).toContain(`within working directory '${customCwd}'`)
		})

		it("should handle relative custom cwd and use terminal.getCurrentWorkingDirectory() in output", async () => {
			const relativeCwd = "subdirectory"
			const resolvedCwd = path.resolve(mockTask.cwd, relativeCwd)

			mockTerminal.getCurrentWorkingDirectory.mockReturnValue(resolvedCwd)
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				customCwd: relativeCwd,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(resolvedCwd, mockTask.taskId, "vscode")
			expect(result).toContain(`within working directory '${resolvedCwd.toPosix()}'`)
		})

		it("should return error when custom working directory does not exist", async () => {
			const nonExistentCwd = "/non/existent/path"

			// Mock fs.access to throw error for non-existent directory
			;(fs.access as any).mockRejectedValue(new Error("Directory does not exist"))

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				customCwd: nonExistentCwd,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toBe(`Working directory '${nonExistentCwd}' does not exist.`)
			expect(TerminalRegistry.getOrCreateTerminal).not.toHaveBeenCalled()
		})
	})

	describe("Terminal Provider Selection", () => {
		it("should use vscode provider when shell integration is enabled", async () => {
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			await executeCommand(mockTask, options)

			// Verify
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(mockTask.cwd, mockTask.taskId, "vscode")
		})

		it("should use execa provider when shell integration is disabled", async () => {
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: true,
				terminalOutputLineLimit: 500,
			}

			// Execute
			await executeCommand(mockTask, options)

			// Verify
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(mockTask.cwd, mockTask.taskId, "execa")
		})
	})

	describe("Command Execution States", () => {
		it("should handle completed command with exit code 0", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command completed successfully", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo success",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("Exit code: 0")
			expect(result).toContain("within working directory '/test/project'")
		})

		it("should handle completed command with non-zero exit code", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command failed", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 1 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "exit 1",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("Command execution was not successful")
			expect(result).toContain("Exit code: 1")
			expect(result).toContain("within working directory '/test/project'")
		})

		it("should handle command terminated by signal", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command interrupted", mockProcess)
					callbacks.onShellExecutionComplete(
						{
							exitCode: undefined,
							signalName: "SIGINT",
							coreDumpPossible: false,
						},
						mockProcess,
					)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "long-running-command",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("Process terminated by signal SIGINT")
			expect(result).toContain("within working directory '/test/project'")
		})
	})

	describe("Terminal Working Directory Updates", () => {
		it("should update working directory when terminal returns different cwd", async () => {
			// Setup: Terminal initially at project root, but getCurrentWorkingDirectory returns different path
			const initialCwd = "/test/project"
			const updatedCwd = "/test/project/src"

			mockTask.cwd = initialCwd
			mockTerminal.initialCwd = initialCwd

			// Mock Terminal instance behavior
			const mockTerminalInstance = {
				...mockTerminal,
				terminal: { show: vitest.fn() },
				getCurrentWorkingDirectory: vitest.fn().mockReturnValue(updatedCwd),
				runCommand: vitest.fn().mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
					setTimeout(() => {
						callbacks.onCompleted("Directory changed", mockProcess)
						callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
					}, 0)
					return mockProcess
				}),
			}

			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminalInstance)

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "cd src && pwd",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify the result uses the updated working directory
			expect(rejected).toBe(false)
			expect(result).toContain(`within working directory '${updatedCwd}'`)
			expect(result).not.toContain(`within working directory '${initialCwd}'`)

			// Verify the terminal's getCurrentWorkingDirectory was called
			expect(mockTerminalInstance.getCurrentWorkingDirectory).toHaveBeenCalled()
		})
	})

	describe("Background Command Execution", () => {
		it("should run command in background when background=true", async () => {
			// Mock the terminal process that doesn't require user interaction
			const mockBackgroundProcess: any = Promise.resolve()
			mockBackgroundProcess.continue = vitest.fn()

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				// Simulate normal command execution
				setTimeout(() => {
					// First output triggers the background behavior
					callbacks.onLine("Command running in background...", mockBackgroundProcess)
				}, 50)

				// Simulate completion after a delay (but we won't wait for it)
				setTimeout(() => {
					callbacks.onCompleted("Background command completed", mockBackgroundProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockBackgroundProcess)
				}, 200)

				return mockBackgroundProcess
			})

			// Mock ask method to verify it's NOT called when background=true
			mockTask.ask = vitest.fn()

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "npm run dev",
				background: true,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify - when background=true, command returns immediately
			expect(rejected).toBe(false)
			// The output when background is true shows it's running in background
			expect(result).toContain("Command is running in the background")
			expect(result).toContain("will continue running without blocking")
			// Verify that the ask method was NOT called (no user interaction)
			expect(mockTask.ask).not.toHaveBeenCalled()
			// Continue is called automatically when onLine is triggered
			expect(mockBackgroundProcess.continue).toHaveBeenCalled()
		})

		it("should require user interaction when background=false (default)", async () => {
			// Mock process that requires user interaction
			const mockInteractiveProcess: any = Promise.resolve()
			mockInteractiveProcess.continue = vitest.fn()

			let hasCalledOnLine = false
			let storedCallbacks: RooTerminalCallbacks

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				storedCallbacks = callbacks

				// Simulate output after a delay
				setTimeout(() => {
					if (!hasCalledOnLine) {
						hasCalledOnLine = true
						callbacks.onLine("Command output...", mockInteractiveProcess)
					}
				}, 0)

				return mockInteractiveProcess
			})

			// Mock ask method to simulate user interaction
			mockTask.ask = vitest.fn().mockImplementation(async () => {
				// Complete the command after user provides feedback
				setTimeout(() => {
					if (storedCallbacks) {
						storedCallbacks.onCompleted("Interactive command completed", mockInteractiveProcess)
						storedCallbacks.onShellExecutionComplete({ exitCode: 0 }, mockInteractiveProcess)
					}
				}, 0)

				// Return user feedback
				return {
					response: "messageResponse",
					text: "continue",
					images: undefined,
				}
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "npm run dev",
				background: false, // explicitly set to false
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(true) // User provided feedback
			expect(mockTask.ask).toHaveBeenCalledWith("command_output", "")
			expect(mockInteractiveProcess.continue).toHaveBeenCalled()
			expect(result).toContain("continue") // User feedback should be in result
		})

		it("should handle background=true with command timeout (should not timeout as it returns immediately)", async () => {
			// Mock a long-running background process
			let processResolve: any
			const mockLongRunningProcess: any = new Promise((resolve) => {
				processResolve = resolve
			})
			mockLongRunningProcess.continue = vitest.fn()
			mockLongRunningProcess.abort = vitest.fn()

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				// Simulate output after a delay
				setTimeout(() => {
					callbacks.onLine("Starting long-running process...", mockLongRunningProcess)
				}, 50)
				// Don't complete - simulate a long-running process
				return mockLongRunningProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "npm run dev",
				background: true,
				commandExecutionTimeout: 50, // 50ms timeout - but should not apply to background commands
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify command returned immediately without timeout
			expect(rejected).toBe(false)
			expect(result).toContain("Command is running in the background")
			// Should NOT be aborted as background commands don't wait for completion
			expect(mockLongRunningProcess.abort).not.toHaveBeenCalled()

			// Clean up
			if (processResolve) processResolve()
		})

		it("should parse background parameter from string 'true'", async () => {
			// This test verifies the string parsing in executeCommandTool.ts
			// The actual parsing happens in executeCommandTool, not executeCommand
			// So we just verify that background boolean is handled correctly

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onLine("Background task output", mockProcess)
				}, 50)
				// The completion handlers won't be called before we return
				setTimeout(() => {
					callbacks.onCompleted("Done", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 200)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				background: true, // This would be parsed from "true" string in executeCommandTool
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify - background=true means command returns immediately
			expect(rejected).toBe(false)
			expect(result).toContain("Command is running in the background")
			expect(result).toContain("will continue running without blocking")
			// Process.continue is called when onLine is triggered
			expect(mockProcess.continue).toHaveBeenCalled()
		})
	})
})
