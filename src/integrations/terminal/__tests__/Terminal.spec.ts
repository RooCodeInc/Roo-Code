// npx vitest run src/integrations/terminal/__tests__/Terminal.spec.ts

import * as vscode from "vscode"
import { Terminal } from "../Terminal"
import { TerminalProcess } from "../TerminalProcess"
import { vi } from "vitest"

// Mock dependencies
vi.mock("vscode", () => ({
	window: {
		createTerminal: vi.fn().mockReturnValue({
			shellIntegration: {
				cwd: { fsPath: "/initial/cwd" },
			},
			sendText: vi.fn(),
			exitStatus: undefined,
		}),
	},
	ThemeIcon: vi.fn(),
}))

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockResolvedValue(true),
}))

vi.mock("../TerminalProcess")
vi.mock("../../../utils/path", () => ({
	arePathsEqual: vi.fn((a, b) => a === b),
}))

describe("Terminal", () => {
	describe("runCommand", () => {
		let terminal: Terminal
		let mockRun: any
		let mockProcess: any

		beforeEach(() => {
			terminal = new Terminal(1, undefined, "/initial/cwd")
			mockRun = vi.fn()
			mockProcess = {
				run: mockRun,
				on: vi.fn(),
				once: vi.fn(),
				emit: vi.fn(),
			}
			vi.mocked(TerminalProcess).mockImplementation((): any => {
				return mockProcess
			})
		})

		afterEach(() => {
			vi.clearAllMocks()
		})

		it("should prepend cd command if requestedCwd differs from currentCwd", () => {
			terminal.requestedCwd = "/requested/cwd"
			vi.spyOn(terminal, "getCurrentWorkingDirectory").mockReturnValue("/initial/cwd")

			const callbacks = {
				onLine: vi.fn(),
				onCompleted: vi.fn(),
				onShellExecutionStarted: vi.fn(),
				onShellExecutionComplete: vi.fn(),
			}

			terminal.runCommand("ls", callbacks)

			expect(mockProcess.command).toBe('cd "/requested/cwd" && ls')
			expect(mockRun).toHaveBeenCalledWith('cd "/requested/cwd" && ls')
		})

		it("should not prepend cd command if requestedCwd is the same as currentCwd", () => {
			terminal.requestedCwd = "/initial/cwd"
			vi.spyOn(terminal, "getCurrentWorkingDirectory").mockReturnValue("/initial/cwd")
			const callbacks = {
				onLine: vi.fn(),
				onCompleted: vi.fn(),
				onShellExecutionStarted: vi.fn(),
				onShellExecutionComplete: vi.fn(),
			}

			terminal.runCommand("ls", callbacks)

			expect(mockProcess.command).toBe("ls")
			expect(mockRun).toHaveBeenCalledWith("ls")
		})

		it("should not prepend cd command if requestedCwd is not set", () => {
			vi.spyOn(terminal, "getCurrentWorkingDirectory").mockReturnValue("/initial/cwd")
			const callbacks = {
				onLine: vi.fn(),
				onCompleted: vi.fn(),
				onShellExecutionStarted: vi.fn(),
				onShellExecutionComplete: vi.fn(),
			}

			terminal.runCommand("ls", callbacks)

			expect(mockProcess.command).toBe("ls")
			expect(mockRun).toHaveBeenCalledWith("ls")
		})
	})
})