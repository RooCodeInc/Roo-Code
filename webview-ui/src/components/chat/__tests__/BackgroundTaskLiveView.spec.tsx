// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/BackgroundTaskLiveView.spec.tsx

import React from "react"
import { render, screen, act, waitFor } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import BackgroundTaskLiveView from "../BackgroundTaskLiveView"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock use-sound
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => [vi.fn()]),
}))

function simulateBackgroundTaskProgress(taskId: string, update: Record<string, unknown>) {
	const event = new MessageEvent("message", {
		data: {
			type: "backgroundTaskProgress",
			backgroundTaskId: taskId,
			backgroundTaskProgress: update,
		},
	})
	window.dispatchEvent(event)
}

describe("BackgroundTaskLiveView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("subscribes to background task on mount and unsubscribes on unmount", () => {
		const { unmount } = render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "subscribeToBackgroundTask",
			text: "task-123",
		})

		unmount()

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "unsubscribeFromBackgroundTask",
		})
	})

	it("shows empty state initially", () => {
		render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		expect(screen.getByTestId("live-empty-state")).toBeTruthy()
		expect(screen.getByText(/Waiting for updates/)).toBeTruthy()
	})

	it("renders progress updates when received", async () => {
		render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskProgress("task-123", {
				kind: "tool_call",
				timestamp: Date.now(),
				toolName: "read_file",
				status: "started",
			})
		})

		await waitFor(() => {
			const items = screen.getAllByTestId("live-update-item")
			expect(items).toHaveLength(1)
		})

		expect(screen.getByText(/read_file -- started/)).toBeTruthy()
	})

	it("shows update count in header", async () => {
		render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskProgress("task-123", {
				kind: "tool_call",
				timestamp: Date.now(),
				toolName: "read_file",
				status: "started",
			})
			simulateBackgroundTaskProgress("task-123", {
				kind: "tool_result",
				timestamp: Date.now(),
				toolName: "read_file",
				status: "completed",
			})
		})

		await waitFor(() => {
			expect(screen.getByText(/2 updates/)).toBeTruthy()
		})
	})

	it("ignores progress updates for different task IDs", async () => {
		render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskProgress("task-different", {
				kind: "tool_call",
				timestamp: Date.now(),
				toolName: "read_file",
				status: "started",
			})
		})

		// Should still show empty state
		expect(screen.getByTestId("live-empty-state")).toBeTruthy()
	})

	it("calls onClose when back button is clicked", async () => {
		const onClose = vi.fn()
		render(<BackgroundTaskLiveView taskId="task-123" onClose={onClose} />)

		// Send an update so the view renders fully
		act(() => {
			simulateBackgroundTaskProgress("task-123", {
				kind: "tool_call",
				timestamp: Date.now(),
				toolName: "read_file",
				status: "started",
			})
		})

		await waitFor(() => {
			expect(screen.getByTestId("live-back-button")).toBeTruthy()
		})

		act(() => {
			screen.getByTestId("live-back-button").click()
		})

		expect(onClose).toHaveBeenCalled()
	})

	it("displays error updates with error message", async () => {
		render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskProgress("task-123", {
				kind: "error",
				timestamp: Date.now(),
				toolName: "execute_command",
				status: "errored",
				errorMessage: "Permission denied",
			})
		})

		await waitFor(() => {
			expect(screen.getByText(/execute_command -- errored: Permission denied/)).toBeTruthy()
		})
	})

	it("caps updates at the rolling window size of 20", async () => {
		render(<BackgroundTaskLiveView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			for (let i = 0; i < 25; i++) {
				simulateBackgroundTaskProgress("task-123", {
					kind: "tool_call",
					timestamp: Date.now() + i,
					toolName: `tool_${i}`,
					status: "started",
				})
			}
		})

		await waitFor(() => {
			const items = screen.getAllByTestId("live-update-item")
			expect(items).toHaveLength(20)
		})
	})
})
