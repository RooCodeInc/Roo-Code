import { describe, it, expect, beforeEach, vi, Mock } from "vitest"
import { UIEventHandler } from "./UIEventHandler"
import { EventBus } from "../events/EventBus"
import { DiffViewProvider } from "../../integrations/editor/DiffViewProvider"
import { StreamEventType, DiffUpdateEvent, TaskProgressEvent, ErrorDisplayEvent } from "../events/types"

// Mock the DiffViewProvider
vi.mock("../../integrations/editor/DiffViewProvider")

describe("UIEventHandler", () => {
	let uiEventHandler: UIEventHandler
	let eventBus: EventBus
	let mockDiffViewProvider: any
	const testTaskId = "/test/workspace"

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create fresh instances
		eventBus = new EventBus()

		// Create mock DiffViewProvider
		mockDiffViewProvider = {
			revertChanges: vi.fn().mockResolvedValue(undefined),
			reset: vi.fn().mockResolvedValue(undefined),
			showDiff: vi.fn().mockResolvedValue(undefined),
			hideDiff: vi.fn().mockResolvedValue(undefined),
			applyDiff: vi.fn().mockResolvedValue(undefined),
			isEditing: false,
		}

		// Create UIEventHandler instance
		uiEventHandler = new UIEventHandler(testTaskId, eventBus, mockDiffViewProvider)
	})

	afterEach(() => {
		uiEventHandler.dispose()
	})

	describe("constructor", () => {
		it("should initialize with correct workspace path", () => {
			expect(uiEventHandler).toBeDefined()
		})

		it("should subscribe to the correct event types", () => {
			const spy = vi.spyOn(eventBus, "on")
			new UIEventHandler(testTaskId, eventBus, mockDiffViewProvider)

			expect(spy).toHaveBeenCalledWith(StreamEventType.DIFF_UPDATE_NEEDED, expect.any(Function))
			expect(spy).toHaveBeenCalledWith(StreamEventType.TASK_PROGRESS_UPDATE, expect.any(Function))
			expect(spy).toHaveBeenCalledWith(StreamEventType.ERROR_DISPLAY_NEEDED, expect.any(Function))
			expect(spy).toHaveBeenCalledWith(StreamEventType.DIFF_VIEW_REVERT_NEEDED, expect.any(Function))
		})
	})

	describe("DIFF_UPDATE_NEEDED events", () => {
		it('should handle "apply" action (no-op)', async () => {
			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "apply",
				filePath: "test.ts",
				metadata: { content: "test content" },
			}

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Apply action is currently a no-op in the implementation
			expect(mockDiffViewProvider.applyDiff).not.toHaveBeenCalled()
		})

		it('should handle "revert" action when editing', async () => {
			mockDiffViewProvider.isEditing = true

			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "revert",
			}

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		})

		it('should not handle "revert" action when not editing', async () => {
			mockDiffViewProvider.isEditing = false

			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "revert",
			}

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockDiffViewProvider.revertChanges).not.toHaveBeenCalled()
		})

		it('should handle "reset" action', async () => {
			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "reset",
			}

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockDiffViewProvider.reset).toHaveBeenCalled()
		})

		it("should handle unknown actions gracefully", async () => {
			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "unknown" as any,
			}

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleSpy).toHaveBeenCalledWith("Unknown diff action: unknown")

			consoleSpy.mockRestore()
		})

		it("should handle errors in diff operations gracefully", async () => {
			mockDiffViewProvider.reset.mockRejectedValue(new Error("Test error"))

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "reset",
			}

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(consoleSpy).toHaveBeenCalledWith(
				"Error handling diff update for task /test/workspace:",
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("TASK_PROGRESS_UPDATE events", () => {
		it("should handle task progress updates", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			const event: TaskProgressEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				progress: 50,
				stage: "processing",
				message: "Processing files...",
			}

			eventBus.emitEvent(StreamEventType.TASK_PROGRESS_UPDATE, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleSpy).toHaveBeenCalledWith("Task /test/workspace progress: processing - Processing files...")
			expect(consoleSpy).toHaveBeenCalledWith("Progress: 50%")

			consoleSpy.mockRestore()
		})

		it("should handle progress updates without message", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			const event: TaskProgressEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				progress: 75,
				stage: "completing",
			}

			eventBus.emitEvent(StreamEventType.TASK_PROGRESS_UPDATE, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleSpy).toHaveBeenCalledWith("Task /test/workspace progress: completing - Stage: completing")
			expect(consoleSpy).toHaveBeenCalledWith("Progress: 75%")

			consoleSpy.mockRestore()
		})
	})

	describe("ERROR_DISPLAY_NEEDED events", () => {
		it("should handle error display events", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const event: ErrorDisplayEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				error: "API request failed",
				severity: "error",
				category: "api",
			}

			eventBus.emitEvent(StreamEventType.ERROR_DISPLAY_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleSpy).toHaveBeenCalledWith("Task /test/workspace error [error][api]: API request failed")

			consoleSpy.mockRestore()
		})

		it("should handle error display with detailed error info", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const event: ErrorDisplayEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				error: "Validation failed",
				severity: "warning",
				category: "validation",
				context: "form validation",
				retryable: true,
			}

			eventBus.emitEvent(StreamEventType.ERROR_DISPLAY_NEEDED, event)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleSpy).toHaveBeenCalledWith(
				"Task /test/workspace error [warning][validation]: Validation failed",
			)
			expect(consoleSpy).toHaveBeenCalledWith("Error context:", "form validation")

			consoleSpy.mockRestore()
		})
	})

	describe("dispose", () => {
		it("should unsubscribe from all events", () => {
			const spy = vi.spyOn(eventBus, "off")

			uiEventHandler.dispose()

			expect(spy).toHaveBeenCalledWith(StreamEventType.DIFF_UPDATE_NEEDED, expect.any(Function))
			expect(spy).toHaveBeenCalledWith(StreamEventType.TASK_PROGRESS_UPDATE, expect.any(Function))
			expect(spy).toHaveBeenCalledWith(StreamEventType.ERROR_DISPLAY_NEEDED, expect.any(Function))
			expect(spy).toHaveBeenCalledWith(StreamEventType.DIFF_VIEW_REVERT_NEEDED, expect.any(Function))
		})

		it("should handle multiple dispose calls gracefully", () => {
			expect(() => {
				uiEventHandler.dispose()
				uiEventHandler.dispose()
			}).not.toThrow()
		})
	})

	describe("event filtering", () => {
		it("should process all events regardless of task ID", async () => {
			// Test that events from different task IDs are processed
			const event1: DiffUpdateEvent = {
				taskId: "task-1",
				timestamp: Date.now(),
				action: "reset",
			}

			const event2: DiffUpdateEvent = {
				taskId: "task-2",
				timestamp: Date.now(),
				action: "reset",
			}

			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event1)
			eventBus.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event2)

			// Allow async operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockDiffViewProvider.reset).toHaveBeenCalledTimes(2)
		})
	})

	describe("integration with EventBus", () => {
		it("should work with EventBus singleton", () => {
			const eventBusSingleton = EventBus.getInstance()
			const handler = new UIEventHandler(testTaskId, eventBusSingleton, mockDiffViewProvider)

			const event: DiffUpdateEvent = {
				taskId: "test-task",
				timestamp: Date.now(),
				action: "reset",
			}

			eventBusSingleton.emitEvent(StreamEventType.DIFF_UPDATE_NEEDED, event)

			handler.dispose()
		})
	})
})
