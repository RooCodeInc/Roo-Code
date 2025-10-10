import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Task } from "../Task"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"
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

describe("Task disposal and resource cleanup", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let task: Task

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

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
		vi.mocked(taskPersistence.saveTaskMessages).mockResolvedValue()
		vi.mocked(taskPersistence.taskMetadata).mockResolvedValue({
			historyItem: {} as any,
			tokenUsage: {
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCost: 0,
				contextTokens: 0,
				totalCacheWrites: 0,
				totalCacheReads: 0,
			},
		})
	})

	afterEach(() => {
		task?.dispose()
	})

	it("should clean up all resources on dispose", async () => {
		// Create task instance without starting it
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Add some messages to simulate usage
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Hello",
		})

		// Verify clineMessages exist
		expect(task.clineMessages.length).toBeGreaterThan(0)

		// Add data to other arrays that dispose should clear
		task["assistantMessageContent"] = [{ type: "text", content: "Assistant message", partial: false }]
		task["userMessageContent"] = [{ type: "text", text: "User message" }]
		task["apiConversationHistory"] = [{ role: "user", content: [{ type: "text", text: "Test" }] }]

		// Verify data exists
		expect(task.assistantMessageContent.length).toBeGreaterThan(0)
		expect(task.userMessageContent.length).toBeGreaterThan(0)
		expect(task.apiConversationHistory.length).toBeGreaterThan(0)

		// Dispose
		task.dispose()

		// Verify all resources are cleaned up
		expect(task.clineMessages).toHaveLength(0)
		expect(task.apiConversationHistory).toHaveLength(0)
		expect(task.assistantMessageContent).toHaveLength(0)
		expect(task.userMessageContent).toHaveLength(0)
	})

	it("should clear all event listeners on dispose", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Add event listeners
		const listener1 = vi.fn()
		const listener2 = vi.fn()
		task.on(RooCodeEventName.TaskActive, listener1)
		task.on(RooCodeEventName.TaskAskResponded, listener2)

		// Verify listeners are registered
		expect(task.listenerCount(RooCodeEventName.TaskActive)).toBe(1)
		expect(task.listenerCount(RooCodeEventName.TaskAskResponded)).toBe(1)

		// Dispose
		task.dispose()

		// Verify all listeners are removed
		expect(task.listenerCount(RooCodeEventName.TaskActive)).toBe(0)
		expect(task.listenerCount(RooCodeEventName.TaskAskResponded)).toBe(0)
	})

	it("should clear all timers on dispose", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Set timers by triggering debounced save
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test",
		})

		// Verify timer exists
		expect(task["saveDebounceTimer"]).toBeDefined()

		// Dispose
		task.dispose()

		// Verify timer is cleared
		expect(task["saveDebounceTimer"]).toBeUndefined()
	})

	it("should flush pending saves before disposal", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})
		const saveSpy = vi.spyOn(task as any, "saveClineMessages")

		// Trigger a debounced save
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test",
		})

		// Verify there's a pending save
		expect(task["pendingSave"]).toBe(true)

		// Dispose (should flush pending save)
		task.dispose()

		// Verify save was attempted
		expect(task["pendingSave"]).toBe(false)
		expect(saveSpy).toHaveBeenCalled()
	})

	it("should dispose message queue service", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})
		const disposeSpy = vi.spyOn(task.messageQueueService, "dispose")

		task.dispose()

		expect(disposeSpy).toHaveBeenCalled()
	})

	it("should handle dispose errors gracefully", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Mock a method to throw an error
		task.messageQueueService.dispose = vi.fn(() => {
			throw new Error("Mock disposal error")
		})

		// Should not throw
		expect(() => task.dispose()).not.toThrow()

		// Should log the error
		expect(consoleErrorSpy).toHaveBeenCalled()

		consoleErrorSpy.mockRestore()
	})

	it("should clear circular references", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Verify controllers exist before dispose
		expect(task["rooIgnoreController"]).toBeDefined()

		task.dispose()

		// Verify circular references are broken
		expect(task["rooIgnoreController"]).toBeUndefined()
		expect(task["rooProtectedController"]).toBeUndefined()
		expect(task["checkpointService"]).toBeUndefined()
		expect(task["terminalProcess"]).toBeUndefined()
	})

	it("should clear large data structures", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Add data to large structures
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test 1",
		})
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Test 2",
		})

		task["assistantMessageContent"] = [{ type: "text", content: "Assistant message", partial: false }]
		task["userMessageContent"] = [{ type: "text", text: "User message" }]
		task["consecutiveMistakeCountForApplyDiff"].set("test.js", 5)

		// Verify data exists
		expect(task.clineMessages.length).toBeGreaterThan(0)
		expect(task["assistantMessageContent"].length).toBeGreaterThan(0)
		expect(task["userMessageContent"].length).toBeGreaterThan(0)
		expect(task["consecutiveMistakeCountForApplyDiff"].size).toBeGreaterThan(0)

		task.dispose()

		// Verify all large structures are cleared
		expect(task.clineMessages).toHaveLength(0)
		expect(task.apiConversationHistory).toHaveLength(0)
		expect(task["assistantMessageContent"]).toHaveLength(0)
		expect(task["userMessageContent"]).toHaveLength(0)
		expect(task["consecutiveMistakeCountForApplyDiff"].size).toBe(0)
	})

	it("should complete dispose successfully multiple times", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// First disposal
		task.dispose()

		// Second disposal should not throw
		expect(() => task.dispose()).not.toThrow()
	})

	it("should log disposal start and completion", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})
		const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		task.dispose()

		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining(`[Task#dispose] disposing task ${task.taskId}`),
		)
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining(`[Task#dispose] completed disposal for task ${task.taskId}`),
		)

		consoleLogSpy.mockRestore()
	})
})
