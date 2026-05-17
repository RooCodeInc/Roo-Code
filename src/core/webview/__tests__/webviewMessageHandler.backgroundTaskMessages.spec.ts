// npx vitest run core/webview/__tests__/webviewMessageHandler.backgroundTaskMessages.spec.ts

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

vi.mock("../../task-persistence", () => ({
	saveTaskMessages: vi.fn(),
	readTaskMessages: vi.fn(),
}))

import { readTaskMessages } from "../../task-persistence"

const mockPostMessageToWebview = vi.fn()

const mockClineProvider = {
	contextProxy: {
		globalStorageUri: { fsPath: "/mock/global/storage" },
		getValue: vi.fn(),
		setValue: vi.fn(),
	},
	postMessageToWebview: mockPostMessageToWebview,
	getStateToPostToWebview: vi.fn().mockResolvedValue({}),
} as unknown as ClineProvider

describe("webviewMessageHandler - requestBackgroundTaskMessages", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("loads task messages from disk and posts them to the webview", async () => {
		const mockMessages = [
			{ ts: 1000, type: "say", say: "text", text: "Hello" },
			{ ts: 2000, type: "say", say: "text", text: "World" },
		]
		vi.mocked(readTaskMessages).mockResolvedValue(mockMessages as any)

		await webviewMessageHandler(mockClineProvider, {
			type: "requestBackgroundTaskMessages",
			text: "task-123",
		})

		expect(readTaskMessages).toHaveBeenCalledWith({
			taskId: "task-123",
			globalStoragePath: "/mock/global/storage",
		})

		expect(mockPostMessageToWebview).toHaveBeenCalledWith({
			type: "backgroundTaskMessages",
			backgroundTaskId: "task-123",
			backgroundTaskMessages: mockMessages,
		})
	})

	it("returns empty array when task has no messages", async () => {
		vi.mocked(readTaskMessages).mockResolvedValue([])

		await webviewMessageHandler(mockClineProvider, {
			type: "requestBackgroundTaskMessages",
			text: "task-empty",
		})

		expect(readTaskMessages).toHaveBeenCalledWith({
			taskId: "task-empty",
			globalStoragePath: "/mock/global/storage",
		})

		expect(mockPostMessageToWebview).toHaveBeenCalledWith({
			type: "backgroundTaskMessages",
			backgroundTaskId: "task-empty",
			backgroundTaskMessages: [],
		})
	})

	it("does nothing when taskId is not provided", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "requestBackgroundTaskMessages",
			// no text/taskId provided
		})

		expect(readTaskMessages).not.toHaveBeenCalled()
		expect(mockPostMessageToWebview).not.toHaveBeenCalled()
	})
})
