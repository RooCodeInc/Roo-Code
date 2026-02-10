// npx vitest core/tools/__tests__/BaseTool.spec.ts

import type { ToolName } from "@roo-code/types"

import { BaseTool, ToolCallbacks } from "../BaseTool"
import type { ToolUse } from "../../../shared/tools"
import { Task } from "../../task/Task"

// Create a concrete implementation for testing
class TestTool extends BaseTool<"read_file"> {
	readonly name = "read_file" as const
	public executeCallCount = 0
	public handlePartialCallCount = 0
	public shouldThrowInHandlePartial = false
	public partialErrorMessage = "Test error"

	async execute(params: any, task: Task, callbacks: ToolCallbacks): Promise<void> {
		this.executeCallCount++
	}

	override async handlePartial(task: Task, block: ToolUse<"read_file">): Promise<void> {
		this.handlePartialCallCount++
		if (this.shouldThrowInHandlePartial) {
			throw new Error(this.partialErrorMessage)
		}
	}

	// Expose protected methods for testing
	public testGetPartialState(task: Task) {
		return this.getPartialState(task)
	}

	public testSetPartialState(task: Task, state: any) {
		this.setPartialState(task, state)
	}

	public testHasPathStabilized(task: Task, path: string | undefined) {
		return this.hasPathStabilized(task, path)
	}

	public testNotifyPartialError(task: Task, errorMessage: string, isPathValidationError = false) {
		return this.notifyPartialError(task, errorMessage, isPathValidationError)
	}

	public testShouldSkipDueToPathError(task: Task) {
		return this.shouldSkipDueToPathError(task)
	}
}

// Mock Task
const createMockTask = (): Task => {
	return {
		id: "test-task-" + Math.random(),
	} as unknown as Task
}

// Mock ToolUse block
const createMockToolUse = (partial: boolean): ToolUse<"read_file"> => ({
	type: "tool_use",
	name: "read_file",
	params: { path: "/test/file.ts" },
	nativeArgs: { path: "/test/file.ts" },
	partial,
})

// Mock callbacks
const createMockCallbacks = (): ToolCallbacks => ({
	askApproval: vi.fn().mockResolvedValue(true),
	handleError: vi.fn().mockResolvedValue(undefined),
	pushToolResult: vi.fn(),
})

describe("BaseTool", () => {
	let testTool: TestTool
	let mockTask: Task
	let mockCallbacks: ToolCallbacks

	beforeEach(() => {
		vi.clearAllMocks()
		testTool = new TestTool()
		mockTask = createMockTask()
		mockCallbacks = createMockCallbacks()
	})

	describe("partial state management", () => {
		it("should initialize with idle state", () => {
			const state = testTool.testGetPartialState(mockTask)
			expect(state.status).toBe("idle")
		})

		it("should isolate state per task", () => {
			const task1 = createMockTask()
			const task2 = createMockTask()

			testTool.testSetPartialState(task1, { status: "streaming", lastSeenPath: "/path1" })
			testTool.testSetPartialState(task2, { status: "streaming", lastSeenPath: "/path2" })

			const state1 = testTool.testGetPartialState(task1)
			const state2 = testTool.testGetPartialState(task2)

			expect(state1.status).toBe("streaming")
			expect((state1 as any).lastSeenPath).toBe("/path1")
			expect(state2.status).toBe("streaming")
			expect((state2 as any).lastSeenPath).toBe("/path2")
		})

		it("should reset state to idle", () => {
			testTool.testSetPartialState(mockTask, {
				status: "erroring",
				errorCount: 5,
				lastErrorMessage: "test",
				firstErrorTime: Date.now(),
			})

			testTool.resetPartialState(mockTask)

			const state = testTool.testGetPartialState(mockTask)
			expect(state.status).toBe("idle")
		})
	})

	describe("hasPathStabilized", () => {
		it("should return false on first call", () => {
			const result = testTool.testHasPathStabilized(mockTask, "/test/path.ts")
			expect(result).toBe(false)
		})

		it("should return true when path matches previous call", () => {
			testTool.testHasPathStabilized(mockTask, "/test/path.ts")
			const result = testTool.testHasPathStabilized(mockTask, "/test/path.ts")
			expect(result).toBe(true)
		})

		it("should return false when path changes", () => {
			testTool.testHasPathStabilized(mockTask, "/test/path1.ts")
			testTool.testHasPathStabilized(mockTask, "/test/path1.ts") // stabilized
			const result = testTool.testHasPathStabilized(mockTask, "/test/path2.ts") // changed
			expect(result).toBe(false)
		})

		it("should return false for undefined path", () => {
			const result = testTool.testHasPathStabilized(mockTask, undefined)
			expect(result).toBe(false)
		})

		it("should return false for empty path", () => {
			testTool.testHasPathStabilized(mockTask, "")
			const result = testTool.testHasPathStabilized(mockTask, "")
			expect(result).toBe(false) // empty string is falsy
		})

		it("should transition from idle to streaming", () => {
			testTool.testHasPathStabilized(mockTask, "/test/path.ts")
			const state = testTool.testGetPartialState(mockTask)
			expect(state.status).toBe("streaming")
		})
	})

	describe("notifyPartialError", () => {
		let consoleErrorSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		})

		afterEach(() => {
			consoleErrorSpy.mockRestore()
		})

		it("should return true and log on first error", () => {
			const result = testTool.testNotifyPartialError(mockTask, "First error")
			expect(result).toBe(true)
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("First error"))
		})

		it("should return false and not log on repeated identical error", () => {
			testTool.testNotifyPartialError(mockTask, "Same error")
			consoleErrorSpy.mockClear()

			const result = testTool.testNotifyPartialError(mockTask, "Same error")
			expect(result).toBe(false)
			expect(consoleErrorSpy).not.toHaveBeenCalled()
		})

		it("should return true and log when error message changes", () => {
			testTool.testNotifyPartialError(mockTask, "Error 1")
			consoleErrorSpy.mockClear()

			const result = testTool.testNotifyPartialError(mockTask, "Error 2")
			expect(result).toBe(true)
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error 2"))
		})

		it("should track error count for repeated errors", () => {
			testTool.testNotifyPartialError(mockTask, "Repeated error")
			testTool.testNotifyPartialError(mockTask, "Repeated error")
			testTool.testNotifyPartialError(mockTask, "Repeated error")

			const state = testTool.testGetPartialState(mockTask)
			expect(state.status).toBe("erroring")
			expect((state as any).errorCount).toBe(3)
		})

		it("should set isPathValidationError flag when specified", () => {
			testTool.testNotifyPartialError(mockTask, "Invalid path: /outside", true)

			const state = testTool.testGetPartialState(mockTask)
			expect(state.status).toBe("erroring")
			expect((state as any).isPathValidationError).toBe(true)
		})
	})

	describe("shouldSkipDueToPathError", () => {
		it("should return false when in idle state", () => {
			const result = testTool.testShouldSkipDueToPathError(mockTask)
			expect(result).toBe(false)
		})

		it("should return false when in streaming state", () => {
			testTool.testSetPartialState(mockTask, { status: "streaming" })
			const result = testTool.testShouldSkipDueToPathError(mockTask)
			expect(result).toBe(false)
		})

		it("should return false for non-path errors", () => {
			testTool.testNotifyPartialError(mockTask, "Some other error", false)
			const result = testTool.testShouldSkipDueToPathError(mockTask)
			expect(result).toBe(false)
		})

		it("should return true for path validation errors", () => {
			testTool.testNotifyPartialError(mockTask, "Invalid path: /outside", true)
			const result = testTool.testShouldSkipDueToPathError(mockTask)
			expect(result).toBe(true)
		})
	})

	describe("handle() - error suppression integration", () => {
		let consoleErrorSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		})

		afterEach(() => {
			consoleErrorSpy.mockRestore()
		})

		it("should call handlePartial for partial blocks", async () => {
			const block = createMockToolUse(true)

			await testTool.handle(mockTask, block, mockCallbacks)

			expect(testTool.handlePartialCallCount).toBe(1)
			expect(testTool.executeCallCount).toBe(0)
		})

		it("should call execute for complete blocks", async () => {
			const block = createMockToolUse(false)

			await testTool.handle(mockTask, block, mockCallbacks)

			expect(testTool.handlePartialCallCount).toBe(0)
			expect(testTool.executeCallCount).toBe(1)
		})

		it("should suppress repeated partial errors", async () => {
			testTool.shouldThrowInHandlePartial = true
			testTool.partialErrorMessage = "Repeated error"
			const block = createMockToolUse(true)

			// First error - logged
			await testTool.handle(mockTask, block, mockCallbacks)
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

			// Second identical error - suppressed
			consoleErrorSpy.mockClear()
			await testTool.handle(mockTask, block, mockCallbacks)
			expect(consoleErrorSpy).not.toHaveBeenCalled()

			// handleError should NOT be called (error suppression)
			expect(mockCallbacks.handleError).not.toHaveBeenCalled()
		})

		it("should skip handlePartial when path error is active (fast-path guard)", async () => {
			// Simulate a path validation error
			testTool.testNotifyPartialError(mockTask, "Invalid path: /outside", true)
			const block = createMockToolUse(true)

			await testTool.handle(mockTask, block, mockCallbacks)

			// handlePartial should be skipped due to fast-path guard
			expect(testTool.handlePartialCallCount).toBe(0)
		})

		it("should recover from error state on reset", async () => {
			// Set up error state
			testTool.testNotifyPartialError(mockTask, "Invalid path: /outside", true)
			expect(testTool.testShouldSkipDueToPathError(mockTask)).toBe(true)

			// Reset state (simulating end of execute)
			testTool.resetPartialState(mockTask)

			// Should no longer skip
			expect(testTool.testShouldSkipDueToPathError(mockTask)).toBe(false)
		})
	})
})
