import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { TodoItem } from "@roo-code/types"

// Mock TelemetryService singleton to avoid uninitialized errors in tests (matches Roo Code test patterns).
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		_instance: {
			captureModeSwitch: vi.fn(),
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureTaskCompleted: vi.fn(),
			captureConversationMessage: vi.fn(),
		},
		get instance() {
			return this._instance
		},
		set instance(value) {
			this._instance = value
		},
	},
}))

beforeEach(() => {
	// In some test runners, TelemetryService may not be stubbed at require time;
	// assign the singleton property here to be robust.
	try {
		const Telemetry = require("@roo-code/telemetry")
		if (Telemetry && Telemetry.TelemetryService) {
			Telemetry.TelemetryService._instance = {
				captureModeSwitch: vi.fn(),
				captureTaskCreated: vi.fn(),
				captureTaskRestarted: vi.fn(),
				captureTaskCompleted: vi.fn(),
			}
		}
	} catch {
		/* ignore */
	}
})

/**
 * Mock VSCode APIs used by RooIgnoreController and Task for all test contexts.
 * This prevents test failures due to missing extension context or filesystem watcher dependencies,
 * including RelativePattern, workspace, window, Uri, and other VSCode stubs.
 */
vi.mock("vscode", () => ({
	RelativePattern: class {},
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => undefined),
		})),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		createTerminal: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({})),
		activeTextEditor: undefined,
		visibleTextEditors: [],
		registerWebviewViewProvider: vi.fn(),
		tabGroups: { all: [] },
	},
	env: { language: "en" },
	Uri: {
		parse: vi.fn((input) => input),
		joinPath: vi.fn((...args) => args.join("/")),
	},
	FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
	languages: { getDiagnostics: vi.fn(() => []) },
}))

describe("Task subtask mode restoration", () => {
	let parentTask: Task
	let mockProvider: any

	const mockContext = {
		globalStorageUri: { fsPath: "/mock/storage" },
	}

	beforeEach(() => {
		const mockAgentAPIs = {
			context: mockContext,
			handleModeSwitch: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
			postStateToWebview: vi.fn(),
			getState: vi.fn(() => ({})),
			ask: vi.fn().mockResolvedValue({ response: "", text: "", images: [] }),
			say: vi.fn().mockResolvedValue(undefined),
		}
		mockProvider = {
			...mockAgentAPIs,
			deref: vi.fn().mockReturnValue({ ...mockAgentAPIs }),
		}
	})

	it("should restore parent task mode when subtask completes", async () => {
		// Create parent task with orchestrator mode
		parentTask = new Task({
			provider: mockProvider as any,
			apiConfiguration: {} as any,
			task: "Parent task",
		})

		// Set parent task to orchestrator mode
		parentTask.pausedModeSlug = "orchestrator"

		// Mock the provider reference
		parentTask.providerRef = {
			deref: () => mockProvider.deref(),
		} as any

		// Complete the subtask
		await parentTask.completeSubtask("Subtask completed")

		// Verify handleModeSwitch was called with the pausedModeSlug
		expect(mockProvider.deref().handleModeSwitch).toHaveBeenCalledWith("orchestrator")

		// Verify task is unpaused
		expect(parentTask.isPaused).toBe(false)

		// Verify childTaskId is cleared
		expect(parentTask.childTaskId).toBeUndefined()
	})

	it("should call handleModeSwitch before UI updates (order of operations)", async () => {
		const callOrder: string[] = []
		const handleModeSwitchSpy = vi.fn(() => {
			callOrder.push("handleModeSwitch")
			return Promise.resolve()
		})
		const postStateToWebviewSpy = vi.fn(() => {
			callOrder.push("postStateToWebview")
			return Promise.resolve()
		})

		mockProvider = {
			...mockProvider,
			handleModeSwitch: handleModeSwitchSpy,
			postStateToWebview: postStateToWebviewSpy,
			deref: vi.fn().mockReturnValue({
				...(mockProvider.deref ? mockProvider.deref() : {}),
				handleModeSwitch: handleModeSwitchSpy,
				postStateToWebview: postStateToWebviewSpy,
			}),
		}
		parentTask = new Task({
			provider: mockProvider as any,
			apiConfiguration: {} as any,
			task: "Parent task",
		})
		parentTask.pausedModeSlug = "orchestrator"
		parentTask.providerRef = {
			deref: () => mockProvider.deref(),
		} as any
		await parentTask.completeSubtask("done")
		// Since only handleModeSwitch (and not postStateToWebview directly) should be called in this minimal patch, assert order and presence
		expect(callOrder.filter((v) => v === "handleModeSwitch").length).toBeGreaterThanOrEqual(1)
		expect(callOrder.indexOf("handleModeSwitch")).toBeLessThan(callOrder.lastIndexOf("postStateToWebview") || 1)
	})

	it("should handle missing provider gracefully", async () => {
		// Create parent task
		parentTask = new Task({
			provider: mockProvider as any,
			apiConfiguration: {} as any,
			task: "Parent task",
		})

		// Set parent task to orchestrator mode
		parentTask.pausedModeSlug = "orchestrator"

		// Mock provider as unavailable
		parentTask.providerRef = {
			deref: () => undefined,
		} as any

		// Complete the subtask - should not throw
		await expect(parentTask.completeSubtask("Subtask completed")).resolves.not.toThrow()

		// Verify task is still unpaused
		expect(parentTask.isPaused).toBe(false)
	})
})
