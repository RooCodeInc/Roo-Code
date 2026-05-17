// npx vitest run core/webview/__tests__/webviewMessageHandler.backgroundTaskProgress.spec.ts

import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"

const mockPostMessageToWebview = vi.fn()

const mockClineProvider = {
	contextProxy: {
		globalStorageUri: { fsPath: "/mock/global/storage" },
		getValue: vi.fn(),
		setValue: vi.fn(),
	},
	postMessageToWebview: mockPostMessageToWebview,
	getStateToPostToWebview: vi.fn().mockResolvedValue({}),
	viewedBackgroundTaskId: null as string | null,
} as unknown as ClineProvider

describe("webviewMessageHandler - background task progress subscription", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		;(mockClineProvider as any).viewedBackgroundTaskId = null
	})

	it("sets viewedBackgroundTaskId on subscribeToBackgroundTask", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "subscribeToBackgroundTask",
			text: "task-456",
		})

		expect((mockClineProvider as any).viewedBackgroundTaskId).toBe("task-456")
	})

	it("clears viewedBackgroundTaskId on unsubscribeFromBackgroundTask", async () => {
		;(mockClineProvider as any).viewedBackgroundTaskId = "task-456"

		await webviewMessageHandler(mockClineProvider, {
			type: "unsubscribeFromBackgroundTask",
		})

		expect((mockClineProvider as any).viewedBackgroundTaskId).toBeNull()
	})

	it("handles subscribeToBackgroundTask with no text gracefully", async () => {
		await webviewMessageHandler(mockClineProvider, {
			type: "subscribeToBackgroundTask",
			// no text
		})

		expect((mockClineProvider as any).viewedBackgroundTaskId).toBeNull()
	})
})
