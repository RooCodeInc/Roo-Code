import { describe, it, expect } from "vitest"
import { mergeExtensionState } from "../ExtensionStateContext"
import type { ExtensionState } from "@roo/ExtensionMessage"

describe("mergeExtensionState", () => {
	it("should create a new taskHistory array reference even when content is the same", () => {
		const prevState = {
			taskHistory: [
				{ id: "task1", ts: 1000, task: "Task 1" },
				{ id: "task2", ts: 2000, task: "Task 2" },
			],
		} as unknown as ExtensionState

		const newState = {
			taskHistory: [
				{ id: "task1", ts: 1000, task: "Task 1" },
				{ id: "task2", ts: 2000, task: "Task 2" },
			],
		} as unknown as ExtensionState

		const merged = mergeExtensionState(prevState, newState)

		// The content should be the same
		expect(merged.taskHistory).toEqual(newState.taskHistory)

		// But the reference should be different to trigger React re-renders
		expect(merged.taskHistory).not.toBe(prevState.taskHistory)
		expect(merged.taskHistory).not.toBe(newState.taskHistory)
	})

	it("should handle empty taskHistory", () => {
		const prevState = {
			taskHistory: [{ id: "task1", ts: 1000, task: "Task 1" }],
		} as unknown as ExtensionState

		const newState = {
			taskHistory: [],
		} as unknown as ExtensionState

		const merged = mergeExtensionState(prevState, newState)

		expect(merged.taskHistory).toEqual([])
		expect(merged.taskHistory).not.toBe(prevState.taskHistory)
		expect(merged.taskHistory).not.toBe(newState.taskHistory)
	})

	it("should handle undefined taskHistory in newState", () => {
		const prevState = {
			taskHistory: [{ id: "task1", ts: 1000, task: "Task 1" }],
		} as unknown as ExtensionState

		const newState = {} as unknown as ExtensionState

		const merged = mergeExtensionState(prevState, newState)

		// Should preserve the previous taskHistory when newState doesn't have it
		expect(merged.taskHistory).toEqual(prevState.taskHistory)
	})

	it("should merge other properties correctly", () => {
		const prevState = {
			version: "1.0.0",
			taskHistory: [],
			customModePrompts: { code: "Old prompt" },
		} as unknown as ExtensionState

		const newState = {
			version: "1.0.1",
			taskHistory: [],
			customModePrompts: { architect: "New prompt" },
		} as unknown as ExtensionState

		const merged = mergeExtensionState(prevState, newState)

		expect(merged.version).toBe("1.0.1")
		expect(merged.customModePrompts).toEqual({
			code: "Old prompt",
			architect: "New prompt",
		})
	})

	it("should always create new taskHistory reference after clearTask scenario", () => {
		// Simulate the clearTask scenario where:
		// 1. User completes a task
		// 2. Clicks new chat
		// 3. Backend sends same taskHistory array

		const taskHistory = [
			{ id: "task1", ts: 1000, task: "Task 1" },
			{ id: "task2", ts: 2000, task: "Task 2" },
		]

		const prevState = {
			taskHistory,
			currentTaskItem: { id: "task2", ts: 2000, task: "Task 2" },
		} as unknown as ExtensionState

		// After clearTask, backend sends the same taskHistory but without currentTaskItem
		const newState = {
			taskHistory, // Same reference!
			currentTaskItem: undefined,
		} as unknown as ExtensionState

		const merged = mergeExtensionState(prevState, newState)

		// The taskHistory should have a new reference to trigger React re-render
		expect(merged.taskHistory).not.toBe(prevState.taskHistory)
		expect(merged.taskHistory).not.toBe(newState.taskHistory)
		expect(merged.taskHistory).toEqual(taskHistory)
		expect(merged.currentTaskItem).toBeUndefined()
	})
})
