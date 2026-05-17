// pnpm --filter @roo-code/vscode-webview test src/components/chat/__tests__/BackgroundTaskReplayView.spec.tsx

import React from "react"
import { render, screen, act, waitFor } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"

import BackgroundTaskReplayView from "../BackgroundTaskReplayView"

// Mock vscode API
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock ChatRow to avoid pulling in heavy dependencies
vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: { ts: number; text?: string } }) {
		return <div data-testid="chat-row">{message.text ?? "message"}</div>
	},
}))

// Mock use-sound
vi.mock("use-sound", () => ({
	default: vi.fn().mockImplementation(() => [vi.fn()]),
}))

// Mock ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn().mockReturnValue({
		clineMessages: [],
		mcpServers: [],
		mode: "code",
		apiConfiguration: {},
		currentTaskItem: null,
	}),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function simulateBackgroundTaskMessages(taskId: string, messages: any[]) {
	const event = new MessageEvent("message", {
		data: {
			type: "backgroundTaskMessages",
			backgroundTaskId: taskId,
			backgroundTaskMessages: messages,
		},
	})
	window.dispatchEvent(event)
}

describe("BackgroundTaskReplayView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("requests messages on mount", () => {
		render(<BackgroundTaskReplayView taskId="task-123" onClose={vi.fn()} />)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "requestBackgroundTaskMessages",
			text: "task-123",
		})
	})

	it("shows loading state initially", () => {
		render(<BackgroundTaskReplayView taskId="task-123" onClose={vi.fn()} />)

		expect(screen.getByTestId("replay-loading")).toBeTruthy()
	})

	it("renders messages when received from extension", async () => {
		render(<BackgroundTaskReplayView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskMessages("task-123", [
				{ ts: 1000, type: "say", say: "text", text: "Hello" },
				{ ts: 2000, type: "say", say: "text", text: "World" },
			])
		})

		await waitFor(() => {
			const rows = screen.getAllByTestId("chat-row")
			expect(rows).toHaveLength(2)
		})
	})

	it("shows empty state when task has no messages", async () => {
		render(<BackgroundTaskReplayView taskId="task-empty" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskMessages("task-empty", [])
		})

		await waitFor(() => {
			expect(screen.getByTestId("replay-empty-state")).toBeTruthy()
		})
	})

	it("calls onClose when back button is clicked", async () => {
		const onClose = vi.fn()
		render(<BackgroundTaskReplayView taskId="task-123" onClose={onClose} />)

		act(() => {
			simulateBackgroundTaskMessages("task-123", [{ ts: 1000, type: "say", say: "text", text: "Hello" }])
		})

		await waitFor(() => {
			expect(screen.getByTestId("replay-back-button")).toBeTruthy()
		})

		act(() => {
			screen.getByTestId("replay-back-button").click()
		})

		expect(onClose).toHaveBeenCalled()
	})

	it("ignores messages for a different task ID", async () => {
		render(<BackgroundTaskReplayView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskMessages("task-different", [
				{ ts: 1000, type: "say", say: "text", text: "Wrong task" },
			])
		})

		// Should still show loading since the task ID didn't match
		expect(screen.getByTestId("replay-loading")).toBeTruthy()
	})

	it("shows message count in header after loading", async () => {
		render(<BackgroundTaskReplayView taskId="task-123" onClose={vi.fn()} />)

		act(() => {
			simulateBackgroundTaskMessages("task-123", [
				{ ts: 1000, type: "say", say: "text", text: "Msg 1" },
				{ ts: 2000, type: "say", say: "text", text: "Msg 2" },
				{ ts: 3000, type: "say", say: "text", text: "Msg 3" },
			])
		})

		await waitFor(() => {
			expect(screen.getByText(/3 messages/)).toBeTruthy()
		})
	})
})
