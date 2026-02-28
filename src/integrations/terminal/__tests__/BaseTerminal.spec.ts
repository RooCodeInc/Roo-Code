// npx vitest run src/integrations/terminal/__tests__/BaseTerminal.spec.ts

import { BaseTerminal } from "../BaseTerminal"
import type { RooTerminalProcess } from "../types"

// Create a concrete implementation of BaseTerminal for testing
class TestTerminal extends BaseTerminal {
	constructor(id: number = 1, cwd: string = "/test") {
		super("vscode", id, cwd)
	}

	isClosed(): boolean {
		return false
	}

	runCommand(): never {
		throw new Error("Not implemented")
	}
}

// Create a mock process for testing
function createMockProcess(command: string): RooTerminalProcess {
	const events: Record<string, ((...args: any[]) => void)[]> = {}

	return {
		command,
		isHot: false,
		run: vi.fn(),
		continue: vi.fn(),
		abort: vi.fn(),
		hasUnretrievedOutput: vi.fn().mockReturnValue(false),
		getUnretrievedOutput: vi.fn().mockReturnValue(""),
		trimRetrievedOutput: vi.fn(),
		on: vi.fn((event: string, handler: (...args: any[]) => void) => {
			if (!events[event]) {
				events[event] = []
			}
			events[event].push(handler)
		}),
		once: vi.fn((event: string, handler: (...args: any[]) => void) => {
			if (!events[event]) {
				events[event] = []
			}
			events[event].push(handler)
		}),
		emit: vi.fn((event: string, ...args: any[]) => {
			const handlers = events[event] || []
			handlers.forEach((handler) => handler(...args))
			return true
		}),
		off: vi.fn(),
		removeListener: vi.fn(),
		removeAllListeners: vi.fn(),
		listeners: vi.fn(),
		rawListeners: vi.fn(),
		listenerCount: vi.fn(),
		prependListener: vi.fn(),
		prependOnceListener: vi.fn(),
		eventNames: vi.fn(),
		addListener: vi.fn(),
		setMaxListeners: vi.fn(),
		getMaxListeners: vi.fn(),
	} as unknown as RooTerminalProcess
}

// Create a mock async iterable stream for testing
async function* createMockStream(): AsyncGenerator<string> {
	yield "test output"
}

describe("BaseTerminal", () => {
	describe("commandsMatch", () => {
		it("returns true for exact match", () => {
			expect(BaseTerminal.commandsMatch("npm test", "npm test")).toBe(true)
		})

		it("returns true for exact match with whitespace trimming", () => {
			expect(BaseTerminal.commandsMatch("  npm test  ", "npm test")).toBe(true)
			expect(BaseTerminal.commandsMatch("npm test", "  npm test  ")).toBe(true)
		})

		it("returns true when actual command starts with expected command (PowerShell workaround)", () => {
			// PowerShell counter workaround appends extra commands
			const expected = "npm test"
			const actual = 'npm test ; "(Roo/PS Workaround: 1)" > $null'
			expect(BaseTerminal.commandsMatch(expected, actual)).toBe(true)
		})

		it("returns true when actual command has trailing sleep command", () => {
			const expected = "npm test"
			const actual = "npm test ; start-sleep -milliseconds 50"
			expect(BaseTerminal.commandsMatch(expected, actual)).toBe(true)
		})

		it("returns false for completely different commands", () => {
			expect(BaseTerminal.commandsMatch("npm test", "conda activate base")).toBe(false)
		})

		it("returns false when commands are similar but not matching", () => {
			expect(BaseTerminal.commandsMatch("npm install", "npm run build")).toBe(false)
		})

		it("returns false for reversed prefix (actual is prefix of expected)", () => {
			// This case should not match - the expected command should be a prefix of actual
			expect(BaseTerminal.commandsMatch("npm test --coverage", "npm test")).toBe(false)
		})

		it("handles empty strings", () => {
			expect(BaseTerminal.commandsMatch("", "")).toBe(true)
			expect(BaseTerminal.commandsMatch("npm test", "")).toBe(false)
			expect(BaseTerminal.commandsMatch("", "npm test")).toBe(false)
		})

		it("handles commands with special characters", () => {
			const expected = 'echo "hello world"'
			const actual = 'echo "hello world"'
			expect(BaseTerminal.commandsMatch(expected, actual)).toBe(true)
		})

		it("handles conda activation commands correctly", () => {
			// Roo's command should not match conda's auto-activation
			expect(BaseTerminal.commandsMatch("npm test", "conda activate base")).toBe(false)
			expect(BaseTerminal.commandsMatch("npm test", "source activate myenv")).toBe(false)
		})
	})

	describe("setActiveStream", () => {
		let terminal: TestTerminal
		let mockProcess: RooTerminalProcess

		beforeEach(() => {
			terminal = new TestTerminal()
			mockProcess = createMockProcess("npm test")
			terminal.process = mockProcess
		})

		it("sets stream when no eventCommand is provided (backwards compatibility)", () => {
			const stream = createMockStream()
			terminal.setActiveStream(stream)

			expect(terminal.running).toBe(true)
			expect(mockProcess.emit).toHaveBeenCalledWith("shell_execution_started", undefined)
			expect(mockProcess.emit).toHaveBeenCalledWith("stream_available", stream)
		})

		it("sets stream when eventCommand matches process command", () => {
			const stream = createMockStream()
			terminal.setActiveStream(stream, undefined, "npm test")

			expect(terminal.running).toBe(true)
			expect(mockProcess.emit).toHaveBeenCalledWith("stream_available", stream)
		})

		it("sets stream when eventCommand starts with process command (PowerShell case)", () => {
			const stream = createMockStream()
			terminal.setActiveStream(stream, undefined, 'npm test ; "(Roo/PS Workaround: 1)" > $null')

			expect(terminal.running).toBe(true)
			expect(mockProcess.emit).toHaveBeenCalledWith("stream_available", stream)
		})

		it("ignores stream when eventCommand does not match process command", () => {
			const stream = createMockStream()
			const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {})

			terminal.setActiveStream(stream, undefined, "conda activate base")

			expect(terminal.running).toBe(false)
			expect(mockProcess.emit).not.toHaveBeenCalledWith("stream_available", expect.anything())
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Ignoring shell execution"))

			consoleSpy.mockRestore()
		})

		it("accepts stream when process has no command set (backward compatibility)", () => {
			mockProcess.command = ""
			const stream = createMockStream()

			// When process.command is empty string, the command verification is skipped
			// for backward compatibility. The process should accept any stream.
			terminal.setActiveStream(stream, undefined, "conda activate base")

			// Since process.command is empty, no verification is done and stream is accepted
			expect(terminal.running).toBe(true)
			expect(mockProcess.emit).toHaveBeenCalledWith("stream_available", stream)
		})

		it("cleans up when stream is undefined", () => {
			terminal.setActiveStream(undefined)

			expect(terminal.isStreamClosed).toBe(true)
		})

		it("handles missing process gracefully", () => {
			terminal.process = undefined
			const stream = createMockStream()
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			terminal.setActiveStream(stream)

			expect(terminal.running).toBe(false)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("process is undefined"))

			consoleSpy.mockRestore()
		})

		it("passes pid to shell_execution_started event", () => {
			const stream = createMockStream()
			const pid = 12345

			terminal.setActiveStream(stream, pid, "npm test")

			expect(mockProcess.emit).toHaveBeenCalledWith("shell_execution_started", pid)
		})
	})
})
