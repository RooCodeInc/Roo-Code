// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/BackgroundTasksList.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"

import BackgroundTasksList from "../BackgroundTasksList"

// Mock use-sound
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => [vi.fn()]),
}))

const mockUseExtensionState = vi.fn()

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: (...args: any[]) => mockUseExtensionState(...args),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function createHistoryItem(overrides: Record<string, any> = {}) {
	return {
		id: "task-1",
		number: 1,
		ts: Date.now(),
		task: "Test background task",
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.001,
		parentTaskId: "parent-1",
		status: "completed" as const,
		mode: "code",
		...overrides,
	}
}

describe("BackgroundTasksList", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue({
			taskHistory: [],
			currentTaskItem: null,
		})
	})

	it("shows empty state when no background tasks exist", () => {
		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		expect(screen.getByTestId("background-tasks-empty")).toBeTruthy()
		expect(screen.getByText(/No background tasks yet/)).toBeTruthy()
	})

	it("shows tasks that have a parentTaskId", () => {
		mockUseExtensionState.mockReturnValue({
			taskHistory: [
				createHistoryItem({ id: "task-1", task: "Background task one", parentTaskId: "parent-1" }),
				createHistoryItem({ id: "task-2", task: "Foreground task (no parent)", parentTaskId: undefined }),
				createHistoryItem({ id: "task-3", task: "Background task two", parentTaskId: "parent-1" }),
			],
			currentTaskItem: null,
		})

		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		expect(screen.getByTestId("background-tasks-list")).toBeTruthy()
		expect(screen.getByTestId("background-task-item-task-1")).toBeTruthy()
		expect(screen.getByTestId("background-task-item-task-3")).toBeTruthy()
		// Foreground task without parentTaskId should NOT appear
		expect(screen.queryByTestId("background-task-item-task-2")).toBeNull()
	})

	it("excludes the current foreground task from the list", () => {
		mockUseExtensionState.mockReturnValue({
			taskHistory: [
				createHistoryItem({ id: "task-1", task: "Background subtask", parentTaskId: "parent-1" }),
				createHistoryItem({ id: "task-current", task: "Current task", parentTaskId: "parent-1" }),
			],
			currentTaskItem: { id: "task-current" },
		})

		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		expect(screen.getByTestId("background-task-item-task-1")).toBeTruthy()
		expect(screen.queryByTestId("background-task-item-task-current")).toBeNull()
	})

	it("calls onSelectTask when a task item is clicked", () => {
		const onSelectTask = vi.fn()
		mockUseExtensionState.mockReturnValue({
			taskHistory: [createHistoryItem({ id: "task-1", task: "Click me", parentTaskId: "parent-1" })],
			currentTaskItem: null,
		})

		render(<BackgroundTasksList onSelectTask={onSelectTask} />)

		fireEvent.click(screen.getByTestId("background-task-item-task-1"))
		expect(onSelectTask).toHaveBeenCalledWith("task-1")
	})

	it("shows task status badges", () => {
		mockUseExtensionState.mockReturnValue({
			taskHistory: [
				createHistoryItem({ id: "task-active", status: "active", parentTaskId: "parent-1" }),
				createHistoryItem({ id: "task-done", status: "completed", parentTaskId: "parent-1" }),
			],
			currentTaskItem: null,
		})

		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		expect(screen.getByText("Running")).toBeTruthy()
		expect(screen.getByText("Completed")).toBeTruthy()
	})

	it("shows active count in summary header", () => {
		mockUseExtensionState.mockReturnValue({
			taskHistory: [
				createHistoryItem({ id: "task-1", status: "active", parentTaskId: "parent-1" }),
				createHistoryItem({ id: "task-2", status: "active", parentTaskId: "parent-1" }),
				createHistoryItem({ id: "task-3", status: "completed", parentTaskId: "parent-1" }),
			],
			currentTaskItem: null,
		})

		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		expect(screen.getByText("2 active")).toBeTruthy()
		expect(screen.getByText("3 total")).toBeTruthy()
	})

	it("shows mode badge when task has a mode", () => {
		mockUseExtensionState.mockReturnValue({
			taskHistory: [createHistoryItem({ id: "task-1", mode: "architect", parentTaskId: "parent-1" })],
			currentTaskItem: null,
		})

		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		expect(screen.getByText("architect")).toBeTruthy()
	})

	it("truncates long task descriptions", () => {
		const longTask = "A".repeat(100)
		mockUseExtensionState.mockReturnValue({
			taskHistory: [createHistoryItem({ id: "task-1", task: longTask, parentTaskId: "parent-1" })],
			currentTaskItem: null,
		})

		render(<BackgroundTasksList onSelectTask={vi.fn()} />)

		// Should be truncated at 80 chars + "..."
		expect(screen.getByText("A".repeat(80) + "...")).toBeTruthy()
	})
})
