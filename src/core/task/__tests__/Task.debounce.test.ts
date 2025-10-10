import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Task } from "../Task"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import * as taskPersistence from "../../task-persistence"

// Mock vscode first - must include all exports used by the codebase
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	RelativePattern: vi.fn(),
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

// Mock other dependencies
vi.mock("../../task-persistence")
vi.mock("../../webview/ClineProvider")
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureEvent: vi.fn(),
			captureMemoryUsage: vi.fn(),
			captureMemoryWarning: vi.fn(),
			captureImageCleanup: vi.fn(),
		},
	},
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		isEnabled: vi.fn(() => false),
		instance: {
			captureEvent: vi.fn(),
		},
	},
	BridgeOrchestrator: {
		subscribeToTask: vi.fn(),
		getInstance: vi.fn(() => ({
			unsubscribeFromTask: vi.fn(),
		})),
	},
}))
vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../context-tracking/FileContextTracker")
vi.mock("../../services/browser/UrlContentFetcher")
vi.mock("../../services/browser/BrowserSession")
vi.mock("../../integrations/editor/DiffViewProvider")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: vi.fn(() => ({
			id: "test-model",
			info: {},
		})),
	})),
}))

describe("Task Message Persistence Debouncing", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let task: Task
	let saveSpy: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Setup mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/mock/storage" },
			} as any,
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				experiments: {},
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn(),
			log: vi.fn(),
		}

		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
		} as ProviderSettings

		// Mock task persistence functions
		vi.mocked(taskPersistence.readTaskMessages).mockResolvedValue([])
		vi.mocked(taskPersistence.readApiMessages).mockResolvedValue([])
		saveSpy = vi.mocked(taskPersistence.saveTaskMessages).mockResolvedValue()
		vi.mocked(taskPersistence.taskMetadata).mockResolvedValue({
			historyItem: {} as any,
			tokenUsage: {
				totalTokens: 0,
				totalCost: 0,
				inputTokens: 0,
				outputTokens: 0,
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
			},
		})

		// Create task instance without starting it
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		task?.dispose()
	})

	it("should debounce multiple rapid addToClineMessages calls", async () => {
		// Add multiple messages rapidly
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 1" })
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 2" })
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 3" })

		// Should not have saved yet
		expect(saveSpy).not.toHaveBeenCalled()

		// Fast-forward time by 500ms (still within debounce window)
		await vi.advanceTimersByTimeAsync(500)
		expect(saveSpy).not.toHaveBeenCalled()

		// Fast-forward remaining time to trigger debounce
		await vi.advanceTimersByTimeAsync(500)

		// Should have saved only once
		expect(saveSpy).toHaveBeenCalledTimes(1)
	})

	it("should reset debounce timer on new message", async () => {
		// Add first message
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 1" })

		// Wait 800ms
		await vi.advanceTimersByTimeAsync(800)
		expect(saveSpy).not.toHaveBeenCalled()

		// Add another message - should reset timer
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 2" })

		// Wait another 800ms (total 1600ms from first message)
		await vi.advanceTimersByTimeAsync(800)
		expect(saveSpy).not.toHaveBeenCalled()

		// Complete the second debounce window
		await vi.advanceTimersByTimeAsync(200)

		// Should have saved only once after the last message's debounce completed
		expect(saveSpy).toHaveBeenCalledTimes(1)
	})

	it("should flush pending saves immediately when flushPendingSave is called", async () => {
		// Add messages
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 1" })
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 2" })

		// Should not have saved yet
		expect(saveSpy).not.toHaveBeenCalled()

		// Force flush
		await (task as any).flushPendingSave()

		// Should have saved immediately
		expect(saveSpy).toHaveBeenCalledTimes(1)

		// Timer should be cleared
		expect((task as any).saveDebounceTimer).toBeUndefined()
		expect((task as any).pendingSave).toBe(false)
	})

	it("should flush pending saves on dispose", async () => {
		// Add messages
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 1" })
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 2" })

		expect(saveSpy).not.toHaveBeenCalled()

		// Dispose task
		task.dispose()

		// Should have attempted to save
		// Note: The save is async and may not complete immediately in dispose
		await vi.runAllTimersAsync()

		// Debounce timer should be cleared
		expect((task as any).saveDebounceTimer).toBeUndefined()
	})

	it("should handle multiple flushPendingSave calls safely", async () => {
		// Add message
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 1" })

		// Flush multiple times
		await (task as any).flushPendingSave()
		await (task as any).flushPendingSave()
		await (task as any).flushPendingSave()

		// Should have saved only once
		expect(saveSpy).toHaveBeenCalledTimes(1)
	})

	it("should not save if no messages were added", async () => {
		// Call flushPendingSave without adding any messages
		await (task as any).flushPendingSave()

		// Should not have saved
		expect(saveSpy).not.toHaveBeenCalled()
	})

	it("should debounce overwriteClineMessages calls", async () => {
		// Overwrite messages multiple times
		await task.overwriteClineMessages([{ ts: Date.now(), type: "say", say: "text", text: "Message 1" }])
		await task.overwriteClineMessages([{ ts: Date.now(), type: "say", say: "text", text: "Message 2" }])

		// Should not have saved yet
		expect(saveSpy).not.toHaveBeenCalled()

		// Fast-forward to trigger debounce
		await vi.advanceTimersByTimeAsync(1000)

		// Should have saved only once
		expect(saveSpy).toHaveBeenCalledTimes(1)
	})

	it("should handle save errors gracefully", async () => {
		// Mock save to throw an error
		saveSpy.mockRejectedValueOnce(new Error("Save failed"))

		// Add message
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 1" })

		// Fast-forward to trigger debounce
		await vi.advanceTimersByTimeAsync(1000)

		// Should have attempted to save
		expect(saveSpy).toHaveBeenCalled()

		// Task should still be functional (not throw)
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message 2" })
		await vi.advanceTimersByTimeAsync(1000)

		// Should have tried again
		expect(saveSpy).toHaveBeenCalledTimes(2)
	})

	it("should use correct debounce delay", async () => {
		// Verify the debounce delay is 1000ms
		expect((task as any).SAVE_DEBOUNCE_MS).toBe(1000)

		// Add message
		await (task as any).addToClineMessages({ ts: Date.now(), type: "say", say: "text", text: "Message" })

		// Should not save before 1000ms
		await vi.advanceTimersByTimeAsync(999)
		expect(saveSpy).not.toHaveBeenCalled()

		// Should save at exactly 1000ms
		await vi.advanceTimersByTimeAsync(1)
		expect(saveSpy).toHaveBeenCalledTimes(1)
	})

	it("should maintain message order with debouncing", async () => {
		// Add messages in sequence
		await (task as any).addToClineMessages({ ts: 1000, type: "say", say: "text", text: "First" })
		await (task as any).addToClineMessages({ ts: 2000, type: "say", say: "text", text: "Second" })
		await (task as any).addToClineMessages({ ts: 3000, type: "say", say: "text", text: "Third" })

		// Trigger save
		await vi.advanceTimersByTimeAsync(1000)

		// Verify all messages were saved in correct order
		expect(saveSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({ text: "First" }),
					expect.objectContaining({ text: "Second" }),
					expect.objectContaining({ text: "Third" }),
				]),
			}),
		)

		// Verify order
		const savedMessages = saveSpy.mock.calls[0][0].messages
		expect(savedMessages[0].text).toBe("First")
		expect(savedMessages[1].text).toBe("Second")
		expect(savedMessages[2].text).toBe("Third")
	})
})
