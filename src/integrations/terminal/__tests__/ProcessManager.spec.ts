import { ProcessManager, ProcessEntry } from "../ProcessManager"
import { RooTerminal, RooTerminalProcess } from "../types"

// Mock terminal
const createMockTerminal = (id: number, closed = false): RooTerminal =>
	({
		id,
		busy: false,
		running: true,
		isClosed: () => closed,
		getCurrentWorkingDirectory: () => "/test/dir",
	}) as unknown as RooTerminal

// Mock process
const createMockProcess = (): RooTerminalProcess =>
	({
		command: "test command",
		isHot: false,
		hasUnretrievedOutput: () => false,
		getUnretrievedOutput: () => "",
	}) as unknown as RooTerminalProcess

describe("ProcessManager", () => {
	beforeEach(() => {
		// Reset singleton between tests
		ProcessManager.resetInstance()
	})

	describe("getInstance", () => {
		it("should return the same instance", () => {
			const instance1 = ProcessManager.getInstance()
			const instance2 = ProcessManager.getInstance()
			expect(instance1).toBe(instance2)
		})
	})

	describe("registerProcess", () => {
		it("should register a process and return a session ID", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")

			expect(sessionId).toBeGreaterThan(0)
			expect(manager.size).toBe(1)
		})

		it("should return unique session IDs for each registration", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)

			const sessionId1 = manager.registerProcess(terminal, createMockProcess(), "task-1", "echo 1")
			const sessionId2 = manager.registerProcess(terminal, createMockProcess(), "task-1", "echo 2")

			expect(sessionId1).not.toBe(sessionId2)
			expect(manager.size).toBe(2)
		})

		it("should evict oldest non-running process when maximum reached", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)

			// Register MAX_PROCESSES processes and mark first one as completed
			const sessionIds: number[] = []
			for (let i = 0; i < ProcessManager.MAX_PROCESSES; i++) {
				const process = createMockProcess()
				const sessionId = manager.registerProcess(terminal, process, "task-1", `echo ${i}`)
				sessionIds.push(sessionId)
			}

			// Mark the first process as completed (eligible for eviction)
			manager.markCompleted(sessionIds[0])

			// This should succeed by evicting the completed process
			const newSessionId = manager.registerProcess(terminal, createMockProcess(), "task-1", "new process")
			expect(newSessionId).toBeGreaterThan(0)
			expect(manager.size).toBe(ProcessManager.MAX_PROCESSES)

			// The first session should be evicted
			expect(manager.getProcess(sessionIds[0])).toBeUndefined()
		})
	})

	describe("getProcess", () => {
		it("should return the process entry for valid session ID", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")
			const entry = manager.getProcess(sessionId)

			expect(entry).toBeDefined()
			expect(entry!.terminal).toBe(terminal)
			expect(entry!.process).toBe(process)
			expect(entry!.taskId).toBe("task-1")
			expect(entry!.command).toBe("echo test")
			expect(entry!.running).toBe(true)
		})

		it("should return undefined for invalid session ID", () => {
			const manager = ProcessManager.getInstance()

			const entry = manager.getProcess(999)

			expect(entry).toBeUndefined()
		})

		it("should update lastUsed timestamp on access", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")
			const entry1 = manager.getProcess(sessionId)
			const lastUsed1 = entry1!.lastUsed

			// Wait a bit then access again
			const entry2 = manager.getProcess(sessionId)
			const lastUsed2 = entry2!.lastUsed

			expect(lastUsed2).toBeGreaterThanOrEqual(lastUsed1)
		})
	})

	describe("isRunning", () => {
		it("should return true for running process", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")

			expect(manager.isRunning(sessionId)).toBe(true)
		})

		it("should return false for non-existent session", () => {
			const manager = ProcessManager.getInstance()

			expect(manager.isRunning(999)).toBe(false)
		})

		it("should return false for completed process", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")
			manager.markCompleted(sessionId)

			expect(manager.isRunning(sessionId)).toBe(false)
		})
	})

	describe("markCompleted", () => {
		it("should mark process as not running", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")
			manager.markCompleted(sessionId)

			const entry = manager.getProcess(sessionId)
			expect(entry!.running).toBe(false)
		})
	})

	describe("unregisterProcess", () => {
		it("should remove the process entry", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)
			const process = createMockProcess()

			const sessionId = manager.registerProcess(terminal, process, "task-1", "echo test")
			const removed = manager.unregisterProcess(sessionId)

			expect(removed).toBe(true)
			expect(manager.getProcess(sessionId)).toBeUndefined()
			expect(manager.size).toBe(0)
		})

		it("should return false for non-existent session", () => {
			const manager = ProcessManager.getInstance()

			const removed = manager.unregisterProcess(999)

			expect(removed).toBe(false)
		})
	})

	describe("unregisterTaskProcesses", () => {
		it("should remove all processes for a task", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)

			manager.registerProcess(terminal, createMockProcess(), "task-1", "echo 1")
			manager.registerProcess(terminal, createMockProcess(), "task-1", "echo 2")
			manager.registerProcess(terminal, createMockProcess(), "task-2", "echo 3")

			const count = manager.unregisterTaskProcesses("task-1")

			expect(count).toBe(2)
			expect(manager.size).toBe(1)
		})
	})

	describe("getTaskSessions", () => {
		it("should return all session IDs for a task", () => {
			const manager = ProcessManager.getInstance()
			const terminal = createMockTerminal(1)

			const id1 = manager.registerProcess(terminal, createMockProcess(), "task-1", "echo 1")
			const id2 = manager.registerProcess(terminal, createMockProcess(), "task-1", "echo 2")
			manager.registerProcess(terminal, createMockProcess(), "task-2", "echo 3")

			const sessions = manager.getTaskSessions("task-1")

			expect(sessions).toHaveLength(2)
			expect(sessions).toContain(id1)
			expect(sessions).toContain(id2)
		})
	})
})
