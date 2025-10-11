// npx vitest core/webview/__tests__/ClineProvider.subtask-cancel.spec.ts

import * as vscode from "vscode"
import { vi, describe, test, expect, beforeEach } from "vitest"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"
import { TelemetryService } from "@roo-code/telemetry"
import pWaitFor from "p-wait-for"

// Mock setup
vi.mock("p-wait-for", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options: any) => {
		const task: any = {
			taskId: "test-task-id",
			instanceId: "test-instance-id",
			parentTask: options.parentTask,
			rootTask: options.rootTask,
			abortReason: undefined,
			abandoned: false,
			isStreaming: false,
			didFinishAbortingStream: false,
			isWaitingForFirstChunk: false,
			wasSubtaskCancelled: false,
			abortTask: vi.fn(),
			completeSubtask: vi.fn(),
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			clineMessages: [],
			apiConversationHistory: [],
			overwriteClineMessages: vi.fn(),
			overwriteApiConversationHistory: vi.fn(),
			handleWebviewAskResponse: vi.fn(),
		}
		// Allow setting properties after creation
		return new Proxy(task, {
			set(target: any, prop: string | symbol, value: any) {
				target[prop] = value
				return true
			},
		})
	}),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn().mockReturnValue(true),
		createInstance: vi.fn(),
		instance: {
			captureCodeActionUsed: vi.fn(),
			setProvider: vi.fn(),
			captureModeSwitch: vi.fn(),
		},
	},
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		instance: null,
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue({
			registerClient: vi.fn(),
			getAllServers: vi.fn().mockReturnValue([]),
		}),
		unregisterProvider: vi.fn(),
	},
}))

vi.mock("../../../services/marketplace", () => ({
	MarketplaceManager: vi.fn().mockImplementation(() => ({
		getMarketplaceItems: vi.fn().mockResolvedValue({ organizationMcps: [], marketplaceItems: [], errors: [] }),
		getInstallationMetadata: vi.fn().mockResolvedValue({ project: {}, global: {} }),
		cleanup: vi.fn(),
	})),
}))

vi.mock("../../config/CustomModesManager", () => ({
	CustomModesManager: vi.fn().mockImplementation(() => ({
		getCustomModes: vi.fn().mockResolvedValue([]),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../config/ProviderSettingsManager", () => ({
	ProviderSettingsManager: vi.fn().mockImplementation(() => ({
		getModeConfigId: vi.fn().mockResolvedValue(undefined),
		listConfig: vi.fn().mockResolvedValue([]),
		activateProfile: vi.fn().mockResolvedValue({}),
		setModeConfig: vi.fn(),
		syncCloudProfiles: vi.fn().mockResolvedValue({ hasChanges: false }),
		resetAllConfigs: vi.fn(),
	})),
}))

vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
		sessionId: "test-session",
		machineId: "test-machine",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
}))

describe("ClineProvider - Subtask Cancellation", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		const globalState: Record<string, any> = {}
		const secrets: Record<string, any> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi.fn().mockImplementation((key: string, value: any) => {
					globalState[key] = value
					return Promise.resolve()
				}),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: any) => {
					secrets[key] = value
					return Promise.resolve()
				}),
				delete: vi.fn().mockImplementation((key: string) => {
					delete secrets[key]
					return Promise.resolve()
				}),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))
	})

	test("cancelling a subtask should not trigger rehydration", async () => {
		// Create parent and child tasks
		const parentTask = new Task({ provider, apiConfiguration: { apiProvider: "openrouter" } }) as any
		const childTask = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
			parentTask: parentTask,
			rootTask: parentTask,
		}) as any

		// Set task IDs after creation
		childTask.taskId = "child-task-id"
		childTask.instanceId = "child-instance-id"

		// Add tasks to stack
		await provider.addClineToStack(parentTask)
		await provider.addClineToStack(childTask)

		// Mock getTaskWithId to simulate task retrieval
		const getTaskWithIdSpy = vi.spyOn(provider as any, "getTaskWithId")
		const createTaskWithHistoryItemSpy = vi.spyOn(provider as any, "createTaskWithHistoryItem")
		const finishSubTaskSpy = vi.spyOn(provider, "finishSubTask")

		// Cancel the subtask
		await provider.cancelTask()

		// Verify that the subtask was aborted
		expect(childTask.abortTask).toHaveBeenCalled()
		expect(childTask.abortReason).toBe("user_cancelled")
		expect(childTask.abandoned).toBe(true)

		// Verify that finishSubTask was called with cancellation flag
		expect(finishSubTaskSpy).toHaveBeenCalledWith("Subtask was cancelled by user", true)

		// Verify that getTaskWithId was NOT called (no rehydration for subtasks)
		expect(getTaskWithIdSpy).not.toHaveBeenCalled()

		// Verify that createTaskWithHistoryItem was NOT called (no rehydration)
		expect(createTaskWithHistoryItemSpy).not.toHaveBeenCalled()
	})

	test("cancelling a non-subtask should trigger rehydration", async () => {
		// Create a single task without parent
		const task = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
			parentTask: undefined,
			rootTask: undefined,
		}) as any

		// Set task IDs after creation
		task.taskId = "main-task-id"
		task.instanceId = "main-instance-id"

		// Add task to stack
		await provider.addClineToStack(task)

		// Mock getTaskWithId to return task info
		const getTaskWithIdSpy = vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: { id: "main-task-id", task: "Test task" },
			taskDirPath: "/test/task/path",
			apiConversationHistoryFilePath: "/test/api/history",
			uiMessagesFilePath: "/test/ui/messages",
			apiConversationHistory: [],
		})

		const createTaskWithHistoryItemSpy = vi
			.spyOn(provider as any, "createTaskWithHistoryItem")
			.mockResolvedValue(undefined)
		const finishSubTaskSpy = vi.spyOn(provider, "finishSubTask")

		// Cancel the task
		await provider.cancelTask()

		// Verify that the task was aborted
		expect(task.abortTask).toHaveBeenCalled()
		expect(task.abortReason).toBe("user_cancelled")
		expect(task.abandoned).toBe(true)

		// Verify that finishSubTask was NOT called (not a subtask)
		expect(finishSubTaskSpy).not.toHaveBeenCalled()

		// Verify that getTaskWithId was called (for rehydration)
		expect(getTaskWithIdSpy).toHaveBeenCalledWith("main-task-id")

		// Verify that createTaskWithHistoryItem was called (rehydration occurred)
		expect(createTaskWithHistoryItemSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "main-task-id",
				task: "Test task",
				rootTask: undefined,
				parentTask: undefined,
			}),
		)
	})

	test("parent task should handle subtask cancellation correctly", async () => {
		// Create parent and child tasks
		const parentTask = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
		}) as any
		const childTask = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
			parentTask: parentTask,
			rootTask: parentTask,
		}) as any

		// Set task IDs after creation
		parentTask.taskId = "parent-task-id"
		parentTask.instanceId = "parent-instance-id"
		childTask.taskId = "child-task-id"
		childTask.instanceId = "child-instance-id"

		// Mock the completeSubtask method on parent
		const completeSubtaskSpy = vi.spyOn(parentTask, "completeSubtask")

		// Add tasks to stack
		await provider.addClineToStack(parentTask)
		await provider.addClineToStack(childTask)

		// Cancel the subtask
		await provider.cancelTask()

		// Wait for async operations
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Verify that parent's completeSubtask was called with cancellation flag
		expect(completeSubtaskSpy).toHaveBeenCalledWith("Subtask was cancelled by user", true)

		// Verify parent task is now the current task
		expect(provider.getCurrentTask()).toBe(parentTask)
	})

	test("should handle race conditions when instance changes during cancellation", async () => {
		// Create a task
		const task = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
			parentTask: undefined,
			rootTask: undefined,
		}) as any

		// Set task IDs after creation
		task.taskId = "task-id"
		task.instanceId = "original-instance"

		// Add task to stack
		await provider.addClineToStack(task)

		// Mock getTaskWithId
		vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: { id: "task-id" },
			taskDirPath: "/test/task/path",
			apiConversationHistoryFilePath: "/test/api/history",
			uiMessagesFilePath: "/test/ui/messages",
			apiConversationHistory: [],
		})

		const createTaskWithHistoryItemSpy = vi
			.spyOn(provider as any, "createTaskWithHistoryItem")
			.mockResolvedValue(undefined)

		// Simulate instance change during cancellation
		const getCurrentTaskSpy = vi.spyOn(provider, "getCurrentTask")
		getCurrentTaskSpy.mockReturnValueOnce(task) // First call returns original task
		getCurrentTaskSpy.mockReturnValueOnce({ ...task, instanceId: "new-instance" } as any) // Second call returns different instance

		// Cancel the task
		await provider.cancelTask()

		// Verify that createTaskWithHistoryItem was NOT called due to instance change
		expect(createTaskWithHistoryItemSpy).not.toHaveBeenCalled()
	})

	test("should wait for task to finish aborting before completing cancellation", async () => {
		// Create a subtask
		const parentTask = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
		}) as any
		const childTask = new Task({
			provider,
			apiConfiguration: { apiProvider: "openrouter" },
			parentTask: parentTask,
			rootTask: parentTask,
		}) as any

		// Set task properties after creation
		childTask.taskId = "child-task-id"
		childTask.isStreaming = true
		childTask.didFinishAbortingStream = false

		// Add tasks to stack
		await provider.addClineToStack(parentTask)
		await provider.addClineToStack(childTask)

		// Mock pWaitFor to simulate waiting
		const pWaitForMock = vi.mocked(pWaitFor)
		pWaitForMock.mockImplementation(async (condition, options) => {
			// Simulate the condition becoming true after a delay
			childTask.isStreaming = false
			childTask.didFinishAbortingStream = true
			return undefined
		})

		// Cancel the subtask
		await provider.cancelTask()

		// Verify that pWaitFor was called to wait for abort completion
		expect(pWaitForMock).toHaveBeenCalledWith(
			expect.any(Function),
			expect.objectContaining({
				timeout: 3000,
			}),
		)

		// Verify abort was called
		expect(childTask.abortTask).toHaveBeenCalled()
	})
})
