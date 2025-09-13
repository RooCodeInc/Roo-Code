import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"

// Mock vscode module
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	ExtensionMode: { Development: 1, Production: 2, Test: 3 },
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, toString: () => path })),
		parse: vi.fn((uri: string) => ({ fsPath: uri })),
	},
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
		workspaceFolders: undefined,
		onDidChangeConfiguration: vi.fn(),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		onDidChangeActiveTextEditor: vi.fn(),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		machineId: "test-machine-id",
		sessionId: "test-session-id",
		appName: "Visual Studio Code",
	},
	version: "1.0.0",
	commands: {
		executeCommand: vi.fn(),
	},
	Range: vi.fn(),
	Position: vi.fn(),
}))

// Mock other dependencies
vi.mock("../../config/ContextProxy")
vi.mock("../../task/Task")
vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue(undefined),
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
		listConfig: vi.fn().mockResolvedValue([]),
		getModeConfigId: vi.fn().mockResolvedValue(undefined),
		resetAllConfigs: vi.fn(),
	})),
}))
vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			setProvider: vi.fn(),
			captureCodeActionUsed: vi.fn(),
			captureModeSwitch: vi.fn(),
		},
	},
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		instance: {
			isAuthenticated: vi.fn().mockReturnValue(false),
			getAllowList: vi.fn().mockResolvedValue("*"),
			getUserInfo: vi.fn().mockReturnValue(null),
			getOrganizationSettings: vi.fn().mockReturnValue(null),
			isTaskSyncEnabled: vi.fn().mockReturnValue(false),
			canShareTask: vi.fn().mockResolvedValue(false),
			getUserSettings: vi.fn().mockReturnValue(null),
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
		connectOrDisconnect: vi.fn(),
		getInstance: vi.fn().mockReturnValue(null),
		subscribeToTask: vi.fn(),
		unsubscribeFromTask: vi.fn(),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://api.roo-code.com"),
}))

describe("ClineProvider - clearTask with pending operations", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		// Create mock instances
		mockContext = {
			globalStorageUri: { fsPath: "/test/storage" },
			extension: { packageJSON: { version: "1.0.0", name: "roo-code" } },
		} as any

		mockOutputChannel = {
			appendLine: vi.fn(),
		} as any

		mockContextProxy = {
			getValues: vi.fn().mockReturnValue({
				taskHistory: [],
				mode: "code",
				apiConfiguration: { apiProvider: "anthropic" },
			}),
			getValue: vi.fn(),
			setValue: vi.fn(),
			setValues: vi.fn(),
			getProviderSettings: vi.fn().mockReturnValue({ apiProvider: "anthropic" }),
			setProviderSettings: vi.fn(),
			resetAllState: vi.fn(),
			extensionUri: { fsPath: "/test/extension" },
			globalStorageUri: { fsPath: "/test/storage" },
		} as any

		// Create provider instance
		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", mockContextProxy)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should clear pending edit operations when clearTask is called", async () => {
		// Setup: Create a mock task with a pending edit operation
		const mockTask = {
			taskId: "test-task-123",
			instanceId: "instance-1",
			clineMessages: [],
			apiConversationHistory: [],
			abandoned: false,
			parentTask: undefined,
			abortTask: vi.fn().mockResolvedValue(undefined),
			overwriteClineMessages: vi.fn(),
			overwriteApiConversationHistory: vi.fn(),
			handleWebviewAskResponse: vi.fn(),
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		} as any

		// Add task to stack
		;(provider as any).clineStack = [mockTask]

		// Set a pending edit operation for this task
		const operationId = `task-${mockTask.taskId}`
		;(provider as any).setPendingEditOperation(operationId, {
			messageTs: 123456789,
			editedContent: "edited content",
			images: [],
			messageIndex: 0,
			apiConversationHistoryIndex: 0,
		})

		// Verify the pending operation exists
		expect((provider as any).getPendingEditOperation(operationId)).toBeDefined()

		// Act: Call clearTask
		await provider.clearTask()

		// Assert: Pending operation should be cleared
		expect((provider as any).getPendingEditOperation(operationId)).toBeUndefined()
		expect((provider as any).clineStack.length).toBe(0)
	})

	it("should not process pending edits when createTaskWithHistoryItem is called after clearTask", async () => {
		// Setup: Create a history item
		const historyItem = {
			id: "test-task-123",
			ts: Date.now(),
			task: "Test task",
			mode: "code",
			workspace: "/test/workspace",
		}

		// Set a pending edit operation that should be cleared
		const operationId = `task-${historyItem.id}`
		;(provider as any).setPendingEditOperation(operationId, {
			messageTs: 123456789,
			editedContent: "edited content that should not be processed",
			images: [],
			messageIndex: 0,
			apiConversationHistoryIndex: 0,
		})

		// Mock Task constructor to capture task creation
		const mockTaskInstance = {
			taskId: historyItem.id,
			instanceId: "instance-1",
			clineMessages: [],
			apiConversationHistory: [],
			abandoned: false,
			overwriteClineMessages: vi.fn(),
			overwriteApiConversationHistory: vi.fn(),
			handleWebviewAskResponse: vi.fn(),
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		}

		vi.mocked(Task).mockImplementation(() => mockTaskInstance as any)

		// Act: Create task with history item (simulating "Start New Task" after completion)
		await provider.createTaskWithHistoryItem(historyItem as any)

		// Wait a bit to ensure any setTimeout callbacks would have executed
		await new Promise((resolve) => setTimeout(resolve, 200))

		// Assert: Pending operation should have been cleared and not processed
		expect((provider as any).getPendingEditOperation(operationId)).toBeUndefined()
		expect(mockTaskInstance.handleWebviewAskResponse).not.toHaveBeenCalled()
		expect(mockTaskInstance.overwriteClineMessages).not.toHaveBeenCalled()
	})

	it("should handle clearTask when no task is active", async () => {
		// Setup: No tasks in stack
		;(provider as any).clineStack = []

		// Act & Assert: Should not throw
		await expect(provider.clearTask()).resolves.not.toThrow()
	})

	it("should clear pending operations even if task removal fails", async () => {
		// Setup: Create a mock task that will throw during removal
		const mockTask = {
			taskId: "test-task-456",
			instanceId: "instance-2",
			abandoned: false,
			abortTask: vi.fn().mockRejectedValue(new Error("Abort failed")),
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		} as any

		;(provider as any).clineStack = [mockTask]

		// Set a pending edit operation
		const operationId = `task-${mockTask.taskId}`
		;(provider as any).setPendingEditOperation(operationId, {
			messageTs: 987654321,
			editedContent: "content",
			images: [],
			messageIndex: 0,
			apiConversationHistoryIndex: 0,
		})

		// Spy on removeClineFromStack to simulate failure
		const removeSpy = vi
			.spyOn(provider as any, "removeClineFromStack")
			.mockRejectedValue(new Error("Remove failed"))

		// Act: Call clearTask (should clear pending operation before attempting removal)
		try {
			await provider.clearTask()
		} catch {
			// Expected to throw due to mocked failure
		}

		// Assert: Pending operation should still be cleared despite removal failure
		expect((provider as any).getPendingEditOperation(operationId)).toBeUndefined()
		expect(removeSpy).toHaveBeenCalled()
	})
})
