import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"

import { API } from "../api"
import { ClineProvider } from "../../core/webview/ClineProvider"

vi.mock("vscode")
vi.mock("../../core/webview/ClineProvider")

describe("API - DeleteQueuedMessage Command", () => {
	let api: API
	let mockOutputChannel: vscode.OutputChannel
	let mockProvider: ClineProvider
	let mockRemoveMessage: ReturnType<typeof vi.fn>
	let mockLog: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockRemoveMessage = vi.fn().mockReturnValue(true)

		mockProvider = {
			context: {} as vscode.ExtensionContext,
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			getCurrentTaskStack: vi.fn().mockReturnValue([]),
			getCurrentTask: vi.fn().mockReturnValue({
				messageQueueService: {
					removeMessage: mockRemoveMessage,
				},
			}),
			viewLaunched: true,
		} as unknown as ClineProvider

		mockLog = vi.fn()

		api = new API(mockOutputChannel, mockProvider, undefined, true)
		;(api as any).log = mockLog
	})

	it("should remove a queued message by id", () => {
		const messageId = "msg-abc-123"

		api.deleteQueuedMessage(messageId)

		expect(mockRemoveMessage).toHaveBeenCalledWith(messageId)
		expect(mockRemoveMessage).toHaveBeenCalledTimes(1)
	})

	it("should handle missing current task gracefully and log a message", () => {
		;(mockProvider.getCurrentTask as ReturnType<typeof vi.fn>).mockReturnValue(undefined)

		// Should not throw
		expect(() => api.deleteQueuedMessage("msg-abc-123")).not.toThrow()
		expect(mockLog).toHaveBeenCalledWith(
			"[API#deleteQueuedMessage] no current task; ignoring delete for messageId msg-abc-123",
		)
		expect(mockRemoveMessage).not.toHaveBeenCalled()
	})

	it("should handle non-existent message id gracefully", () => {
		mockRemoveMessage.mockReturnValue(false)

		// Should not throw even when removeMessage returns false
		expect(() => api.deleteQueuedMessage("non-existent-id")).not.toThrow()
		expect(mockRemoveMessage).toHaveBeenCalledWith("non-existent-id")
	})
})
