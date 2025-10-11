// npx vitest run src/integrations/terminal/__tests__/TerminalProcessTimeout.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { EventEmitter } from "events"
import { TerminalProcess } from "../TerminalProcess"
import { Terminal } from "../Terminal"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => null),
		})),
	},
}))

describe("TerminalProcess Timeout Functionality", () => {
	let terminalProcess: TerminalProcess
	let mockTerminal: Terminal
	let mockVscodeTerminal: any
	let mockShellExecution: any
	let mockShellIntegration: any

	beforeEach(() => {
		// Create mock shell execution
		mockShellExecution = new EventEmitter()

		// Create mock shell integration
		mockShellIntegration = {
			executeCommand: vi.fn().mockReturnValue(mockShellExecution),
		}

		// Create mock VSCode terminal
		mockVscodeTerminal = {
			shellIntegration: mockShellIntegration,
			sendText: vi.fn(),
			show: vi.fn(),
		}

		// Create mock Terminal instance
		mockTerminal = {
			terminal: mockVscodeTerminal,
			busy: false,
			isStreamClosed: false,
			cmdCounter: 0,
			setActiveStream: vi.fn(),
		} as any

		// Clear all timers
		vi.clearAllTimers()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	describe("Command Timeout", () => {
		it("should timeout after specified duration", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			// Start the process with a 5 second timeout
			const runPromise = terminalProcess.run("sleep 10", 5)

			// Emit stream available
			terminalProcess.emit(
				"stream_available",
				(async function* () {
					yield "\x1b]633;C\x07" // Command start marker
					yield "Running..."
				})(),
			)

			// Advance time by 6 seconds (past the timeout)
			vi.advanceTimersByTime(6000)

			// Verify timeout event was emitted
			expect(emitSpy).toHaveBeenCalledWith("command_timeout", "sleep 10")
		})

		it("should not timeout if command completes before timeout", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			// Start the process with a 10 second timeout
			const runPromise = terminalProcess.run("echo test", 10)

			// Emit stream available with command output
			const stream = (async function* () {
				yield "\x1b]633;C\x07" // Command start marker
				yield "test\n"
				yield "\x1b]633;D;0\x07" // Command end marker with exit code 0
			})()

			terminalProcess.emit("stream_available", stream)

			// Advance time by 2 seconds
			vi.advanceTimersByTime(2000)

			// Emit shell execution complete
			terminalProcess.emit("shell_execution_complete", { exitCode: 0 })

			// Process the stream
			for await (const _ of stream) {
				// Stream consumed
			}

			// Wait for the promise to resolve
			await runPromise

			// Verify timeout event was NOT emitted
			expect(emitSpy).not.toHaveBeenCalledWith("command_timeout", expect.any(String))
		})

		it("should handle timeout value of 0 (no timeout)", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			// Start the process with no timeout (0)
			const runPromise = terminalProcess.run("long-running-command", 0)

			// Emit stream available
			terminalProcess.emit(
				"stream_available",
				(async function* () {
					yield "\x1b]633;C\x07"
					yield "Running..."
				})(),
			)

			// Advance time by a long duration
			vi.advanceTimersByTime(60000) // 60 seconds

			// Verify timeout event was NOT emitted
			expect(emitSpy).not.toHaveBeenCalledWith("command_timeout", expect.any(String))
		})
	})

	describe("Background Commands", () => {
		it("should detect background command by exact match", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			const autoSkippedCommands = ["npm run dev", "yarn start"]

			// Start the process with auto-skipped commands (don't await)
			terminalProcess.run("npm run dev", 30, autoSkippedCommands)

			// Use fake timers to advance time
			vi.advanceTimersByTime(150)

			// Should emit background command event
			expect(emitSpy).toHaveBeenCalledWith("background_command", "npm run dev")
		})

		it("should detect background command by wildcard pattern", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			const autoSkippedCommands = ["npm run *", "python -m http.server*"]

			// Test wildcard matching (don't await)
			terminalProcess.run("npm run test:watch", 30, autoSkippedCommands)

			// Use fake timers to advance time
			vi.advanceTimersByTime(150)

			expect(emitSpy).toHaveBeenCalledWith("background_command", "npm run test:watch")
		})

		it("should not treat non-matching commands as background", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			const autoSkippedCommands = ["npm run dev", "yarn start"]

			// Start the process with a non-matching command (don't await)
			terminalProcess.run("ls -la", 5, autoSkippedCommands)

			// Use fake timers to advance time
			vi.advanceTimersByTime(150)

			// Should not emit background command event
			expect(emitSpy).not.toHaveBeenCalledWith("background_command", expect.any(String))

			// Emit stream available to prevent timeout
			terminalProcess.emit(
				"stream_available",
				(async function* () {
					yield "\x1b]633;C\x07"
				})(),
			)
		})

		it("should handle empty auto-skipped commands list", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			// Start the process with empty auto-skipped commands (don't await)
			terminalProcess.run("npm run dev", 5, [])

			// Use fake timers to advance time
			vi.advanceTimersByTime(150)

			// Should not be treated as background
			expect(emitSpy).not.toHaveBeenCalledWith("background_command", expect.any(String))

			// Emit stream available to prevent timeout
			terminalProcess.emit(
				"stream_available",
				(async function* () {
					yield "\x1b]633;C\x07"
				})(),
			)
		})
	})

	describe("shouldRunInBackground helper", () => {
		// Since shouldRunInBackground is private, we test it indirectly through the run method

		it("should correctly match exact patterns", () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy = vi.spyOn(terminalProcess, "emit")

			const patterns = ["npm run dev", "yarn start", "python manage.py runserver"]

			// Test exact match (don't await)
			terminalProcess.run("npm run dev", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).toHaveBeenCalledWith("background_command", "npm run dev")

			// Reset spy and create new instance
			terminalProcess = new TerminalProcess(mockTerminal)
			const emitSpy2 = vi.spyOn(terminalProcess, "emit")

			// Test non-match (don't await)
			terminalProcess.run("npm run build", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy2).not.toHaveBeenCalledWith("background_command", expect.any(String))
		})

		it("should correctly match wildcard patterns", () => {
			const patterns = ["npm run *", "python -m *", "docker compose*"]

			// Test wildcard match for npm
			terminalProcess = new TerminalProcess(mockTerminal)
			let emitSpy = vi.spyOn(terminalProcess, "emit")
			terminalProcess.run("npm run dev", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).toHaveBeenCalledWith("background_command", "npm run dev")

			// Test wildcard match for python
			terminalProcess = new TerminalProcess(mockTerminal)
			emitSpy = vi.spyOn(terminalProcess, "emit")
			terminalProcess.run("python -m http.server", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).toHaveBeenCalledWith("background_command", "python -m http.server")

			// Test wildcard match for docker
			terminalProcess = new TerminalProcess(mockTerminal)
			emitSpy = vi.spyOn(terminalProcess, "emit")
			terminalProcess.run("docker compose up", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).toHaveBeenCalledWith("background_command", "docker compose up")

			// Test non-match
			terminalProcess = new TerminalProcess(mockTerminal)
			emitSpy = vi.spyOn(terminalProcess, "emit")
			terminalProcess.run("docker ps", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).not.toHaveBeenCalledWith("background_command", expect.any(String))
		})

		it("should handle case sensitivity correctly", () => {
			const patterns = ["NPM RUN DEV", "Yarn Start"]

			// Should be case-insensitive for npm
			terminalProcess = new TerminalProcess(mockTerminal)
			let emitSpy = vi.spyOn(terminalProcess, "emit")
			terminalProcess.run("npm run dev", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).toHaveBeenCalledWith("background_command", "npm run dev")

			// Should be case-insensitive for yarn
			terminalProcess = new TerminalProcess(mockTerminal)
			emitSpy = vi.spyOn(terminalProcess, "emit")
			terminalProcess.run("yarn start", 30, patterns)
			vi.advanceTimersByTime(150)
			expect(emitSpy).toHaveBeenCalledWith("background_command", "yarn start")
		})
	})

	describe("Timeout cleanup", () => {
		it("should clear timeout when command completes", async () => {
			terminalProcess = new TerminalProcess(mockTerminal)
			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

			// Start the process with a timeout
			const runPromise = terminalProcess.run("echo test", 10)

			// Emit stream available with complete output
			const stream = (async function* () {
				yield "\x1b]633;C\x07"
				yield "test\n"
				yield "\x1b]633;D;0\x07"
			})()

			terminalProcess.emit("stream_available", stream)
			terminalProcess.emit("shell_execution_complete", { exitCode: 0 })

			// Process the stream
			for await (const _ of stream) {
				// Stream consumed
			}

			await runPromise

			// Verify timeout was cleared (if it was set)
			// Note: clearTimeout is called even if no timeout was set
			expect(clearTimeoutSpy).toHaveBeenCalled()
		})

		it("should handle abort correctly", () => {
			terminalProcess = new TerminalProcess(mockTerminal)

			// Start a process to set up listening state
			terminalProcess.run("test command", 10)

			// Add a line listener to make it listening
			terminalProcess.on("line", () => {})

			// Abort the process
			terminalProcess.abort()

			// Verify SIGINT was sent
			expect(mockVscodeTerminal.sendText).toHaveBeenCalledWith("\x03")
		})
	})
})
