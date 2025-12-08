// npx vitest run integrations/terminal/__tests__/ExecaTerminalProcess.spec.ts

const mockPid = 12345

vitest.mock("execa", () => {
	const mockKill = vitest.fn()
	const execa = vitest.fn((options: any) => {
		return (_template: TemplateStringsArray, ...args: any[]) => ({
			pid: mockPid,
			iterable: (_opts: any) =>
				(async function* () {
					yield "test output\n"
				})(),
			kill: mockKill,
		})
	})
	return { execa, ExecaError: class extends Error {} }
})

vitest.mock("ps-tree", () => ({
	default: vitest.fn((_: number, cb: any) => cb(null, [])),
}))

import { execa } from "execa"
import { ExecaTerminalProcess } from "../ExecaTerminalProcess"
import type { RooTerminal } from "../types"

describe("ExecaTerminalProcess", () => {
	let mockTerminal: RooTerminal
	let terminalProcess: ExecaTerminalProcess
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		originalEnv = { ...process.env }
		mockTerminal = {
			provider: "execa",
			id: 1,
			busy: false,
			running: false,
			getCurrentWorkingDirectory: vitest.fn().mockReturnValue("/test/cwd"),
			isClosed: vitest.fn().mockReturnValue(false),
			runCommand: vitest.fn(),
			setActiveStream: vitest.fn(),
			shellExecutionComplete: vitest.fn(),
			getProcessesWithOutput: vitest.fn().mockReturnValue([]),
			getUnretrievedOutput: vitest.fn().mockReturnValue(""),
			getLastCommand: vitest.fn().mockReturnValue(""),
			cleanCompletedProcessQueue: vitest.fn(),
		} as unknown as RooTerminal
		terminalProcess = new ExecaTerminalProcess(mockTerminal)
	})

	afterEach(() => {
		process.env = originalEnv
		vitest.clearAllMocks()
	})

	describe("UTF-8 encoding fix", () => {
		it("should set LANG and LC_ALL to en_US.UTF-8", async () => {
			await terminalProcess.run("echo test")
			const execaMock = vitest.mocked(execa)
			expect(execaMock).toHaveBeenCalledWith(
				expect.objectContaining({
					shell: true,
					cwd: "/test/cwd",
					all: true,
					env: expect.objectContaining({
						LANG: "en_US.UTF-8",
						LC_ALL: "en_US.UTF-8",
					}),
				}),
			)
		})

		it("should preserve existing environment variables", async () => {
			process.env.EXISTING_VAR = "existing"
			terminalProcess = new ExecaTerminalProcess(mockTerminal)
			await terminalProcess.run("echo test")
			const execaMock = vitest.mocked(execa)
			const calledOptions = execaMock.mock.calls[0][0] as any
			expect(calledOptions.env.EXISTING_VAR).toBe("existing")
		})

		it("should override existing LANG and LC_ALL values", async () => {
			process.env.LANG = "C"
			process.env.LC_ALL = "POSIX"
			terminalProcess = new ExecaTerminalProcess(mockTerminal)
			await terminalProcess.run("echo test")
			const execaMock = vitest.mocked(execa)
			const calledOptions = execaMock.mock.calls[0][0] as any
			expect(calledOptions.env.LANG).toBe("en_US.UTF-8")
			expect(calledOptions.env.LC_ALL).toBe("en_US.UTF-8")
		})
	})

	describe("basic functionality", () => {
		it("should create instance with terminal reference", () => {
			expect(terminalProcess).toBeInstanceOf(ExecaTerminalProcess)
			expect(terminalProcess.terminal).toBe(mockTerminal)
		})

		it("should emit shell_execution_complete with exitCode 0", async () => {
			const spy = vitest.fn()
			terminalProcess.on("shell_execution_complete", spy)
			await terminalProcess.run("echo test")
			expect(spy).toHaveBeenCalledWith({ exitCode: 0 })
		})

		it("should emit completed event with full output", async () => {
			const spy = vitest.fn()
			terminalProcess.on("completed", spy)
			await terminalProcess.run("echo test")
			expect(spy).toHaveBeenCalledWith("test output\n")
		})

		it("should set and clear active stream", async () => {
			await terminalProcess.run("echo test")
			expect(mockTerminal.setActiveStream).toHaveBeenCalledWith(expect.any(Object), mockPid)
			expect(mockTerminal.setActiveStream).toHaveBeenLastCalledWith(undefined)
		})
	})

	describe("peekAllUnretrievedOutput", () => {
		it("should return all unretrieved output including incomplete lines", () => {
			// Manually set up the internal state to simulate output accumulation
			// Access private properties for testing purposes
			const process = terminalProcess as any
			process.fullOutput = "line1\nline2\nincomplete"
			process.lastRetrievedIndex = 0

			// peekAllUnretrievedOutput should return everything including the incomplete line
			const peeked = terminalProcess.peekAllUnretrievedOutput()
			expect(peeked).toBe("line1\nline2\nincomplete")

			// Call again - should return same result since peek doesn't consume
			const peekedAgain = terminalProcess.peekAllUnretrievedOutput()
			expect(peekedAgain).toBe("line1\nline2\nincomplete")
		})

		it("should return empty string when no unretrieved output", () => {
			// Simulate already retrieved state
			const process = terminalProcess as any
			process.fullOutput = "all retrieved\n"
			process.lastRetrievedIndex = "all retrieved\n".length

			const peeked = terminalProcess.peekAllUnretrievedOutput()
			expect(peeked).toBe("")
		})

		it("should not affect lastRetrievedIndex", () => {
			// Set up state with some output
			const process = terminalProcess as any
			process.fullOutput = "line1\nline2\n"
			process.lastRetrievedIndex = 0

			// Peek first - should NOT update lastRetrievedIndex
			terminalProcess.peekAllUnretrievedOutput()
			expect(process.lastRetrievedIndex).toBe(0)

			// hasUnretrievedOutput should still return true
			expect(terminalProcess.hasUnretrievedOutput()).toBe(true)

			// getUnretrievedOutput should still return the output and update lastRetrievedIndex
			const output = terminalProcess.getUnretrievedOutput()
			expect(output).toBe("line1\nline2\n")

			// Now lastRetrievedIndex should be updated
			expect(process.lastRetrievedIndex).toBe("line1\nline2\n".length)

			// hasUnretrievedOutput should return false
			expect(terminalProcess.hasUnretrievedOutput()).toBe(false)
		})

		it("should return partial output after some retrieval", () => {
			// Simulate partial retrieval
			const process = terminalProcess as any
			process.fullOutput = "line1\nline2\nline3\n"
			process.lastRetrievedIndex = "line1\n".length

			// peek should return only the unretrieved part
			const peeked = terminalProcess.peekAllUnretrievedOutput()
			expect(peeked).toBe("line2\nline3\n")
		})
	})
})
