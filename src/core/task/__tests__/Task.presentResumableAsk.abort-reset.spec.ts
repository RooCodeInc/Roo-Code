import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ProviderSettings } from "@roo-code/types"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"

// Mocks similar to Task.dispose.test.ts
vi.mock("../../webview/ClineProvider")
vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))
vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../context-tracking/FileContextTracker")
vi.mock("../../../services/browser/UrlContentFetcher")
vi.mock("../../../services/browser/BrowserSession")
vi.mock("../../../integrations/editor/DiffViewProvider")
vi.mock("../../tools/ToolRepetitionDetector")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: () => ({ info: {}, id: "test-model" }),
	})),
}))
vi.mock("../AutoApprovalHandler")

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
		},
	},
}))

describe("Task.presentResumableAsk abort reset", () => {
	let mockProvider: any
	let mockApiConfiguration: ProviderSettings
	let task: Task

	beforeEach(() => {
		vi.clearAllMocks()

		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/path" },
			},
			getState: vi.fn().mockResolvedValue({ mode: "code" }),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiKey: "test-key",
		} as ProviderSettings

		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			startTask: false,
		})
	})

	afterEach(() => {
		// Ensure we don't leave event listeners dangling
		task.dispose()
	})

	it("resets abort flags and continues the loop on yesButtonClicked", async () => {
		// Arrange aborted state
		task.abort = true
		task.abortReason = "user_cancelled"
		task.didFinishAbortingStream = true
		task.isStreaming = true

		// minimal message history
		task.clineMessages = [{ ts: Date.now() - 1000, type: "say", say: "text", text: "prev" } as any]

		// Spy and stub ask + loop
		const askSpy = vi.spyOn(task as any, "ask").mockResolvedValue({ response: "yesButtonClicked" })
		const loopSpy = vi.spyOn(task as any, "initiateTaskLoop").mockResolvedValue(undefined)

		// Act
		await task.presentResumableAsk()

		// Assert ask was presented
		expect(askSpy).toHaveBeenCalled()

		// Abort flags cleared
		expect(task.abort).toBe(false)
		expect(task.abandoned).toBe(false)
		expect(task.abortReason).toBeUndefined()
		expect(task.didFinishAbortingStream).toBe(false)
		expect(task.isStreaming).toBe(false)

		// Streaming-local state cleared
		expect(task.currentStreamingContentIndex).toBe(0)
		expect(task.assistantMessageContent).toEqual([])
		expect(task.userMessageContentReady).toBe(false)
		expect(task.didRejectTool).toBe(false)
		expect(task.presentAssistantMessageLocked).toBe(false)

		// Loop resumed
		expect(loopSpy).toHaveBeenCalledTimes(1)
	})

	it("includes user feedback when resuming with messageResponse", async () => {
		task.abort = true
		task.clineMessages = [{ ts: Date.now() - 1000, type: "say", say: "text", text: "prev" } as any]

		const askSpy = vi
			.spyOn(task as any, "ask")
			.mockResolvedValue({ response: "messageResponse", text: "Continue with this", images: undefined })
		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined as any)
		const loopSpy = vi.spyOn(task as any, "initiateTaskLoop").mockResolvedValue(undefined)

		await task.presentResumableAsk()

		expect(askSpy).toHaveBeenCalled()
		expect(saySpy).toHaveBeenCalledWith("user_feedback", "Continue with this", undefined)
		expect(loopSpy).toHaveBeenCalledTimes(1)
	})

	it("does nothing when user clicks Terminate (noButtonClicked)", async () => {
		task.abort = true
		task.abortReason = "user_cancelled"
		task.clineMessages = [{ ts: Date.now() - 1000, type: "say", say: "text", text: "prev" } as any]

		vi.spyOn(task as any, "ask").mockResolvedValue({ response: "noButtonClicked" })
		const loopSpy = vi.spyOn(task as any, "initiateTaskLoop").mockResolvedValue(undefined)

		await task.presentResumableAsk()

		// Still aborted
		expect(task.abort).toBe(true)
		expect(task.abortReason).toBe("user_cancelled")
		// No loop resume
		expect(loopSpy).not.toHaveBeenCalled()
	})
})
