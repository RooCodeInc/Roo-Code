// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/BackgroundTaskView.spec.tsx

import React from "react"
import { render, screen, fireEvent, act } from "@/utils/test-utils"

import BackgroundTaskView from "../BackgroundTaskView"

// Mock use-sound
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => [vi.fn()]),
}))

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn().mockReturnValue({
		taskHistory: [
			{
				id: "bg-task-1",
				number: 1,
				ts: Date.now() - 60000,
				task: "Research API docs",
				tokensIn: 100,
				tokensOut: 50,
				totalCost: 0.001,
				parentTaskId: "parent-1",
				status: "completed",
				mode: "ask",
			},
			{
				id: "bg-task-2",
				number: 2,
				ts: Date.now(),
				task: "Implement feature",
				tokensIn: 200,
				tokensOut: 100,
				totalCost: 0.002,
				parentTaskId: "parent-1",
				status: "active",
				mode: "code",
			},
		],
		currentTaskItem: null,
		clineMessages: [],
		mcpServers: [],
		mode: "code",
		apiConfiguration: {},
	}),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock ChatRow for BackgroundTaskReplayView
vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: { ts: number; text?: string } }) {
		return <div data-testid="chat-row">{message.text ?? "message"}</div>
	},
}))

// Mock BackgroundTaskLiveView
vi.mock("../BackgroundTaskLiveView", () => ({
	default: function MockBackgroundTaskLiveView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
		return (
			<div data-testid="background-task-live-view">
				<button data-testid="live-back-button" onClick={onClose}>
					Back
				</button>
				<span>Live view for {taskId}</span>
			</div>
		)
	},
}))

describe("BackgroundTaskView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the list view by default", () => {
		render(<BackgroundTaskView onClose={vi.fn()} />)

		expect(screen.getByTestId("background-task-view")).toBeTruthy()
		expect(screen.getByTestId("background-task-view-header")).toBeTruthy()
		expect(screen.getByTestId("background-tasks-list")).toBeTruthy()
		expect(screen.getByText("Background Tasks")).toBeTruthy()
	})

	it("calls onClose when back-to-chat button is clicked", () => {
		const onClose = vi.fn()
		render(<BackgroundTaskView onClose={onClose} />)

		fireEvent.click(screen.getByTestId("background-task-view-back"))
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("navigates to replay view when a task is clicked", () => {
		render(<BackgroundTaskView onClose={vi.fn()} />)

		// Click on a task to open replay
		fireEvent.click(screen.getByTestId("background-task-item-bg-task-1"))

		// Should now show the replay view (in loading state), not the list
		expect(screen.getByTestId("replay-loading")).toBeTruthy()
		expect(screen.queryByTestId("background-tasks-list")).toBeNull()
	})

	it("navigates back to list from replay view via back button", () => {
		render(<BackgroundTaskView onClose={vi.fn()} />)

		// Navigate to replay
		fireEvent.click(screen.getByTestId("background-task-item-bg-task-1"))
		expect(screen.getByTestId("replay-loading")).toBeTruthy()

		// Simulate messages arriving so replay-back-button appears
		act(() => {
			const event = new MessageEvent("message", {
				data: {
					type: "backgroundTaskMessages",
					backgroundTaskId: "bg-task-1",
					backgroundTaskMessages: [{ ts: 1000, type: "say", say: "text", text: "Hello" }],
				},
			})
			window.dispatchEvent(event)
		})

		// Click back button in replay view
		fireEvent.click(screen.getByTestId("replay-back-button"))

		// Should return to list view
		expect(screen.getByTestId("background-tasks-list")).toBeTruthy()
	})

	it("hides the top header when in replay view (replay has its own header)", () => {
		render(<BackgroundTaskView onClose={vi.fn()} />)

		// Header should be visible in list view
		expect(screen.getByTestId("background-task-view-header")).toBeTruthy()

		// Navigate to replay
		fireEvent.click(screen.getByTestId("background-task-item-bg-task-1"))

		// Top header should be hidden -- replay has its own back button
		expect(screen.queryByTestId("background-task-view-header")).toBeNull()
	})

	it("navigates to live view when an active task is clicked", () => {
		render(<BackgroundTaskView onClose={vi.fn()} />)

		// Click on the active task (bg-task-2 has status "active")
		fireEvent.click(screen.getByTestId("background-task-item-bg-task-2"))

		// Should show the live view, not the replay view
		expect(screen.getByTestId("background-task-live-view")).toBeTruthy()
		expect(screen.queryByTestId("replay-loading")).toBeNull()
		expect(screen.queryByTestId("background-tasks-list")).toBeNull()
	})

	it("navigates back to list from live view via back button", () => {
		render(<BackgroundTaskView onClose={vi.fn()} />)

		// Navigate to live view for active task
		fireEvent.click(screen.getByTestId("background-task-item-bg-task-2"))
		expect(screen.getByTestId("background-task-live-view")).toBeTruthy()

		// Click back button in live view
		fireEvent.click(screen.getByTestId("live-back-button"))

		// Should return to list view
		expect(screen.getByTestId("background-tasks-list")).toBeTruthy()
	})
})
