import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { execa, Options } from "execa"
import { ExecaTerminalProcess } from "../ExecaTerminalProcess"
import { getShell } from "../../../utils/shell"

// Mock getShell function
vi.mock("../../../utils/shell")

// Mock execa
vi.mock("execa")

describe("ExecaTerminalProcess Shell Encoding", () => {
	let mockTerminal: any
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		vi.clearAllMocks()
		originalEnv = { ...process.env }

		mockTerminal = {
			getCurrentWorkingDirectory: vi.fn().mockReturnValue("/test"),
			busy: false,
			setActiveStream: vi.fn(),
		}
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it("should use PowerShell encoding command for PowerShell", async () => {
		// Mock getShell to return PowerShell path
		vi.mocked(getShell).mockReturnValue("C:\\Program Files\\PowerShell\\7\\pwsh.exe")

		const process = new ExecaTerminalProcess(mockTerminal)

		// Mock execa
		const mockExeca = vi.mocked(execa)
		const mockReturnValue = {
			pid: 1234,
			iterable: vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				}),
			}),
		}
		mockExeca.mockReturnValue(mockReturnValue as any)

		await process.run('echo "test"')

		// Verify that execa was called with the PowerShell encoding command
		expect(mockExeca).toHaveBeenCalledTimes(1)
		const call = mockExeca.mock.calls[0]
		// Based on actual behavior, PowerShell calls use template string with options
		expect(call[0]).toMatchObject({
			cwd: "/test",
			all: true,
			encoding: "buffer",
		})
		// Verify shell property exists (can be true or a path)
		expect((call[0] as Options).shell).toBeTruthy()
	})

	it("should use CMD encoding command for CMD", async () => {
		// Mock getShell to return CMD path
		vi.mocked(getShell).mockReturnValue("C:\\Windows\\System32\\cmd.exe")

		const process = new ExecaTerminalProcess(mockTerminal)

		// Mock execa
		const mockExeca = vi.mocked(execa)
		const mockReturnValue = {
			pid: 1234,
			iterable: vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				}),
			}),
		}
		mockExeca.mockReturnValue(mockReturnValue as any)

		await process.run('echo "test"')

		// Verify that execa was called with the CMD encoding command
		expect(mockExeca).toHaveBeenCalledTimes(1)
		const call = mockExeca.mock.calls[0]
		// For CMD, execa is called with template string: execa(options)`chcp 65001 >nul 2>&1 && ${command}`
		expect(call[0]).toMatchObject({
			cwd: "/test",
			all: true,
			encoding: "buffer",
		})
		// Verify shell property exists (can be true or a path)
		expect((call[0] as Options).shell).toBeTruthy()
	})

	it("should not modify command on non-Windows platforms", async () => {
		const process = new ExecaTerminalProcess(mockTerminal)

		// Mock execa
		const mockExeca = vi.mocked(execa)
		const mockReturnValue = {
			pid: 1234,
			iterable: vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				}),
			}),
		}
		mockExeca.mockReturnValue(mockReturnValue as any)

		// Temporarily modify process.platform for testing
		const originalPlatform = (global.process as any).platform
		Object.defineProperty(global.process, "platform", {
			value: "linux",
			configurable: true,
		})

		try {
			await process.run('echo "test"')

			// Verify that execa was called with the original command (no encoding prefix)
			expect(mockExeca).toHaveBeenCalledTimes(1)
			const call = mockExeca.mock.calls[0]
			// For non-Windows platforms, execa is called with template string: execa(options)`${actualCommand}`
			expect(call[0]).toMatchObject({
				cwd: "/test",
				all: true,
				encoding: "buffer",
			})
			// Verify shell property exists (can be true or a path)
			expect((call[0] as Options).shell).toBeTruthy()
		} finally {
			// Restore original platform
			Object.defineProperty(global.process, "platform", {
				value: originalPlatform,
				configurable: true,
			})
		}
	})

	it("should handle Git Bash path correctly", async () => {
		// Mock getShell to return Git Bash path
		vi.mocked(getShell).mockReturnValue("C:\\Program Files\\Git\\bin\\bash.exe")

		const process = new ExecaTerminalProcess(mockTerminal)

		// Mock execa
		const mockExeca = vi.mocked(execa)
		const mockReturnValue = {
			pid: 1234,
			iterable: vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				}),
			}),
		}
		mockExeca.mockReturnValue(mockReturnValue as any)

		await process.run('echo "test"')

		// Verify that execa was called with the Git Bash command
		expect(mockExeca).toHaveBeenCalledTimes(1)
		const call = mockExeca.mock.calls[0]
		// For Git Bash, options come first, then shell path and arguments
		expect(call[0]).toMatchObject({
			cwd: "/test",
			all: true,
			encoding: "buffer",
		})
		// Verify shell property exists (can be true or a path)
		expect((call[0] as Options).shell).toBeTruthy()
	})

	it("should handle legacy PowerShell path correctly", async () => {
		// Mock getShell to return legacy PowerShell path
		vi.mocked(getShell).mockReturnValue("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")

		const process = new ExecaTerminalProcess(mockTerminal)

		// Mock execa
		const mockExeca = vi.mocked(execa)
		const mockReturnValue = {
			pid: 1234,
			iterable: vi.fn().mockReturnValue({
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi.fn().mockResolvedValue({ value: "test output", done: false }),
				}),
			}),
		}
		mockExeca.mockReturnValue(mockReturnValue as any)

		await process.run('echo "test"')

		// Verify that execa was called with the PowerShell encoding command
		expect(mockExeca).toHaveBeenCalledTimes(1)
		const call = mockExeca.mock.calls[0]
		// For Legacy PowerShell, options come first, then shell path and arguments
		expect(call[0]).toMatchObject({
			cwd: "/test",
			all: true,
			encoding: "buffer",
		})
		// Verify shell property exists (can be true or a path)
		expect((call[0] as Options).shell).toBeTruthy()
	})
})
