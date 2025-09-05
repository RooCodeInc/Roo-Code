import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { TodoItem } from "@roo-code/types"

describe("Task subtask mode restoration", () => {
	let parentTask: Task
	let mockProvider: any

	beforeEach(() => {
		mockProvider = {
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
			deref: vi.fn().mockReturnValue({
				handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			}),
		}
	})

	it("should restore parent task mode when subtask completes", async () => {
		// Create parent task with orchestrator mode
		parentTask = new Task({
			provider: mockProvider as any,
			apiConfiguration: {} as any,
			task: "Parent task",
		})
		
		// Set parent task to orchestrator mode
		parentTask.pausedModeSlug = "orchestrator"
		
		// Mock the provider reference
		parentTask.providerRef = {
			deref: () => mockProvider.deref(),
		} as any

		// Complete the subtask
		await parentTask.completeSubtask("Subtask completed")

		// Verify handleModeSwitch was called with the pausedModeSlug
		expect(mockProvider.deref().handleModeSwitch).toHaveBeenCalledWith("orchestrator")
		
		// Verify task is unpaused
		expect(parentTask.isPaused).toBe(false)
		
		// Verify childTaskId is cleared
		expect(parentTask.childTaskId).toBeUndefined()
	})

	it("should handle missing provider gracefully", async () => {
		// Create parent task
		parentTask = new Task({
			provider: mockProvider as any,
			apiConfiguration: {} as any,
			task: "Parent task",
		})
		
		// Set parent task to orchestrator mode
		parentTask.pausedModeSlug = "orchestrator"
		
		// Mock provider as unavailable
		parentTask.providerRef = {
			deref: () => undefined,
		} as any

		// Complete the subtask - should not throw
		await expect(parentTask.completeSubtask("Subtask completed")).resolves.not.toThrow()
		
		// Verify task is still unpaused
		expect(parentTask.isPaused).toBe(false)
	})
})