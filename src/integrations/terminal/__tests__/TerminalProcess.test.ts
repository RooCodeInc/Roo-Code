import * as vscode from "vscode"
import { TerminalProcess } from "../TerminalProcess"
import { Terminal } from "../Terminal"

// Mock dependencies
vi.mock("vscode", () => ({
	window: {
		createTerminal: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
		}),
	},
	ThemeIcon: vi.fn(),
}))

describe("TerminalProcess ANSI Handling", () => {
	let terminalProcess: any // Using any to access private methods
	let mockTerminal: any

	beforeEach(() => {
		mockTerminal = {
			shellIntegration: {
				executeCommand: vi.fn(),
			},
			name: "Test Terminal",
			processId: Promise.resolve(123),
			creationOptions: {},
			exitStatus: undefined,
			state: { isInteractedWith: true },
			dispose: vi.fn(),
			hide: vi.fn(),
			show: vi.fn(),
			sendText: vi.fn(),
		}

		const terminalInfo = new Terminal(1, mockTerminal, "/tmp")
		terminalProcess = new TerminalProcess(terminalInfo)
	})

	describe("removeVSCodeShellIntegration", () => {
		it("should preserve standard ANSI SGR sequences", () => {
			const input = "\x1B[32mgreen text\x1B[0m"
			const result = terminalProcess.removeVSCodeShellIntegration(input)
			expect(result).toBe("\x1B[32mgreen text\x1B[0m")
		})

		it("should remove OSC 633 sequences", () => {
			const input = "\x1B]633;A\x07some text"
			const result = terminalProcess.removeVSCodeShellIntegration(input)
			expect(result).toBe("some text")
		})

		it("should remove OSC 133 sequences", () => {
			const input = "\x1B]133;A\x07some text"
			const result = terminalProcess.removeVSCodeShellIntegration(input)
			expect(result).toBe("some text")
		})

		it("should handle mixed sequences", () => {
			const input = "\x1B]633;C\x07\x1B[1m\x1B[32m✓\x1B[39m\x1B[22m test passed"
			const result = terminalProcess.removeVSCodeShellIntegration(input)
			expect(result).toBe("\x1B[1m\x1B[32m✓\x1B[39m\x1B[22m test passed")
		})

		it("should remove other OSC sequences", () => {
			const input = "\x1B]0;Console Title\x07Content"
			const result = terminalProcess.removeVSCodeShellIntegration(input)
			expect(result).toBe("Content")
		})
	})

	describe("stripCursorSequences", () => {
		it("should remove cursor movement codes", () => {
			const input = "text\x1B[1Aup\x1B[2Kclear"
			const result = terminalProcess.stripCursorSequences(input)
			expect(result).toBe("textupclear")
		})

		it("should preserve colors while removing cursor codes", () => {
			const input = "\x1B[31mred\x1B[1B\x1B[32mgreen"
			const result = terminalProcess.stripCursorSequences(input)
			expect(result).toBe("\x1B[31mred\x1B[32mgreen")
		})
	})
})
