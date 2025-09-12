import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { Task } from "../../task/Task"
import { ContextProxy } from "../../config/ContextProxy"
import { HistoryItem } from "@roo-code/types"

// Mock dependencies
vi.mock("vscode", () => ({
	ExtensionMode: {
		Development: 1,
		Production: 2,
		Test: 3,
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, toString: () => path })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		workspaceFolders: [],
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn(),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	commands: {
		executeCommand: vi.fn(),
	},
	env: {
		machineId: "test-machine-id",
		sessionId: "test-session-id",
		language: "en",
		uriScheme: "vscode",
		appName: "Visual Studio Code",
	},
	version: "1.0.0",
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
}))
vi.mock("../../task/Task")
vi.mock("../../../utils/fs")
vi.mock("../../../utils/git")
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))
vi.mock("../../config/ProviderSettingsManager", () => ({
	ProviderSettingsManager: vi.fn().mockImplementation(() => ({
		syncCloudProfiles: vi.fn(),
		listConfig: vi.fn().mockResolvedValue([]),
		getModeConfigId: vi.fn(),
		getProfile: vi.fn(),
		setModeConfig: vi.fn(),
		activateProfile: vi.fn(),
		saveConfig: vi.fn(),
		resetAllConfigs: vi.fn(),
	})),
}))
vi.mock("../../config/CustomModesManager", () => ({
	CustomModesManager: vi.fn().mockImplementation(() => ({
		getCustomModes: vi.fn().mockResolvedValue([]),
		resetCustomModes: vi.fn(),
		dispose: vi.fn(),
	})),
}))
vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue({
			registerClient: vi.fn(),
			unregisterClient: vi.fn(),
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
			captureTaskRestarted: vi.fn(),
			captureTaskCreated: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureLlmCompletion: vi.fn(),
			captureTaskCompleted: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		instance: {
			isAuthenticated: vi.fn().mockReturnValue(false),
			getUserInfo: vi.fn().mockReturnValue(null),
			canShareTask: vi.fn().mockReturnValue(false),
			getOrganizationSettings: vi.fn().mockReturnValue(null),
			isTaskSyncEnabled: vi.fn().mockReturnValue(false),
			getAllowList: vi.fn().mockReturnValue("*"),
		},
		isEnabled: vi.fn().mockReturnValue(false),
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
		getInstance: vi.fn().mockReturnValue(null),
		subscribeToTask: vi.fn(),
		unsubscribeFromTask: vi.fn(),
		connectOrDisconnect: vi.fn(),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://api.roo-code.com"),
}))

describe("ClineProvider Task Reconstruction", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		// Setup mocks
		mockContext = {
			globalStorageUri: { fsPath: "/mock/storage" },
			extension: { packageJSON: { version: "1.0.0" } },
		} as any

		mockOutputChannel = {
			appendLine: vi.fn(),
		} as any

		mockContextProxy = {
			extensionUri: vscode.Uri.file("/mock/extension"),
			extensionMode: vscode.ExtensionMode.Development,
			getValues: vi.fn().mockReturnValue({}),
			getValue: vi.fn(),
			setValue: vi.fn(),
			setValues: vi.fn(),
			getProviderSettings: vi.fn().mockReturnValue({ apiProvider: "anthropic" }),
			setProviderSettings: vi.fn(),
			resetAllState: vi.fn(),
		} as any

		// Mock vscode.workspace
		vi.mocked(vscode.workspace).getConfiguration = vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		})

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", mockContextProxy)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("reconstructTaskStack", () => {
		it("should not restart finished subtasks", async () => {
			// Mock a completed subtask
			const completedSubtaskHistory: HistoryItem = {
				id: "completed-subtask-id",
				ts: Date.now(),
				task: "Test completed subtask",
				parentTaskId: "parent-task-id",
				rootTaskId: "root-task-id",
				number: 2,
				workspace: "/test/workspace",
				tokensIn: 100,
				tokensOut: 50,
				totalCost: 0.01,
			}

			const parentTaskHistory: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now() - 1000,
				task: "Test parent task",
				number: 1,
				workspace: "/test/workspace",
				tokensIn: 200,
				tokensOut: 100,
				totalCost: 0.02,
			}

			// Mock saved messages for completed task
			const completedTaskMessages = [
				{ type: "say", say: "text", text: "Starting task..." },
				{ type: "ask", ask: "completion_result", text: "Task completed successfully!" },
			]

			const parentTaskMessages = [{ type: "say", say: "text", text: "Parent task running..." }]

			// Mock the getSavedTaskMessages method
			;(provider as any).getSavedTaskMessages = vi.fn().mockImplementation((taskId: string) => {
				if (taskId === "completed-subtask-id") {
					return Promise.resolve(completedTaskMessages)
				} else if (taskId === "parent-task-id") {
					return Promise.resolve(parentTaskMessages)
				}
				return Promise.resolve([])
			})

			// Mock getTaskWithId
			;(provider as any).getTaskWithId = vi.fn().mockImplementation((id: string) => {
				if (id === "completed-subtask-id") {
					return Promise.resolve({ historyItem: completedSubtaskHistory })
				} else if (id === "parent-task-id") {
					return Promise.resolve({ historyItem: parentTaskHistory })
				}
				throw new Error("Task not found")
			})

			// Mock getState
			;(provider as any).getState = vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "anthropic" },
				diffEnabled: true,
				enableCheckpoints: true,
				fuzzyMatchThreshold: 1.0,
				experiments: {},
				cloudUserInfo: null,
				remoteControlEnabled: false,
			})

			// Mock Task constructor
			const mockTaskConstructor = vi.mocked(Task)
			mockTaskConstructor.mockImplementation(
				(options: any) =>
					({
						taskId: options.historyItem.id,
						instanceId: "mock-instance",
						isPaused: false,
						parentTask: options.parentTask,
						rootTask: options.rootTask,
						emit: vi.fn(),
						getSavedClineMessages: vi.fn().mockResolvedValue([]),
						getSavedApiConversationHistory: vi.fn().mockResolvedValue([]),
						abortTask: vi.fn(),
						dispose: vi.fn(),
					}) as any,
			)

			// Mock addClineToStack
			;(provider as any).addClineToStack = vi.fn()

			// Call reconstructTaskStack
			await (provider as any).reconstructTaskStack(completedSubtaskHistory)

			// Verify that the completed subtask was created with startTask: false
			const taskConstructorCalls = mockTaskConstructor.mock.calls
			expect(taskConstructorCalls).toHaveLength(2) // Parent + completed subtask

			// Find the completed subtask call
			const completedSubtaskCall = taskConstructorCalls.find(
				(call) => call[0]?.historyItem?.id === "completed-subtask-id",
			)
			expect(completedSubtaskCall).toBeDefined()
			if (completedSubtaskCall) {
				expect(completedSubtaskCall[0].startTask).toBe(false) // Should not start completed task
			}

			// Find the parent task call
			const parentTaskCall = taskConstructorCalls.find((call) => call[0]?.historyItem?.id === "parent-task-id")
			expect(parentTaskCall).toBeDefined()
			if (parentTaskCall) {
				expect(parentTaskCall[0].startTask).toBe(false) // Parent should not start either
			}
		})

		it("should recover original stack if reconstruction fails", async () => {
			const targetHistory: HistoryItem = {
				id: "target-task-id",
				ts: Date.now(),
				task: "Test target task",
				parentTaskId: "parent-task-id",
				number: 2,
				workspace: "/test/workspace",
				tokensIn: 150,
				tokensOut: 75,
				totalCost: 0.015,
			}

			// Create mock tasks for original stack
			const originalTask1 = {
				taskId: "original-1",
				instanceId: "instance-1",
				isPaused: false,
				abort: false,
				abandoned: false,
			} as any

			const originalTask2 = {
				taskId: "original-2",
				instanceId: "instance-2",
				isPaused: true,
				abort: false,
				abandoned: false,
			} as any

			// Set up original stack
			;(provider as any).clineStack = [originalTask1, originalTask2]

			// Mock buildTaskHierarchy to throw an error
			;(provider as any).buildTaskHierarchy = vi.fn().mockRejectedValue(new Error("Failed to build hierarchy"))

			// Mock removeClineFromStack to clear the stack
			;(provider as any).removeClineFromStack = vi.fn().mockImplementation(() => {
				;(provider as any).clineStack = []
				return Promise.resolve()
			})

			// Attempt reconstruction (should fail and recover)
			await expect((provider as any).reconstructTaskStack(targetHistory)).rejects.toThrow(
				"Failed to build hierarchy",
			)

			// Verify that the original stack was recovered
			expect((provider as any).clineStack).toHaveLength(2)
			expect((provider as any).clineStack[0].taskId).toBe("original-1")
			expect((provider as any).clineStack[1].taskId).toBe("original-2")
		})

		it("should handle completed tasks correctly in createTaskFromHistoryItem", async () => {
			const completedTaskHistory: HistoryItem = {
				id: "completed-task-id",
				ts: Date.now(),
				task: "Test completed task",
				number: 1,
				workspace: "/test/workspace",
				tokensIn: 100,
				tokensOut: 50,
				totalCost: 0.01,
			}

			// Mock saved messages for completed task
			const completedTaskMessages = [
				{ type: "say", say: "text", text: "Starting task..." },
				{ type: "ask", ask: "completion_result", text: "Task completed successfully!" },
			]

			// Mock the getSavedTaskMessages method
			;(provider as any).getSavedTaskMessages = vi.fn().mockResolvedValue(completedTaskMessages)

			// Mock getState
			;(provider as any).getState = vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "anthropic" },
				diffEnabled: true,
				enableCheckpoints: true,
				fuzzyMatchThreshold: 1.0,
				experiments: {},
				cloudUserInfo: null,
				remoteControlEnabled: false,
			})

			// Mock Task constructor
			const mockTaskConstructor = vi.mocked(Task)
			mockTaskConstructor.mockImplementation(
				(options: any) =>
					({
						taskId: options.historyItem.id,
						instanceId: "mock-instance",
						startTask: options.startTask,
					}) as any,
			)

			// Call createTaskFromHistoryItem with shouldStart: true
			const task = await (provider as any).createTaskFromHistoryItem(completedTaskHistory, true)

			// Verify that the task was created with startTask: false (because it's completed)
			expect(mockTaskConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					startTask: false, // Should be false for completed tasks
				}),
			)
		})

		it("should start non-completed tasks normally", async () => {
			const incompleteTaskHistory: HistoryItem = {
				id: "incomplete-task-id",
				ts: Date.now(),
				task: "Test incomplete task",
				number: 1,
				workspace: "/test/workspace",
				tokensIn: 100,
				tokensOut: 50,
				totalCost: 0.01,
			}

			// Mock saved messages for incomplete task (no completion_result)
			const incompleteTaskMessages = [
				{ type: "say", say: "text", text: "Starting task..." },
				{ type: "ask", ask: "tool_use", text: "Using some tool..." },
			]

			// Mock the getSavedTaskMessages method
			;(provider as any).getSavedTaskMessages = vi.fn().mockResolvedValue(incompleteTaskMessages)

			// Mock getState
			;(provider as any).getState = vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "anthropic" },
				diffEnabled: true,
				enableCheckpoints: true,
				fuzzyMatchThreshold: 1.0,
				experiments: {},
				cloudUserInfo: null,
				remoteControlEnabled: false,
			})

			// Mock Task constructor
			const mockTaskConstructor = vi.mocked(Task)
			mockTaskConstructor.mockImplementation(
				(options: any) =>
					({
						taskId: options.historyItem.id,
						instanceId: "mock-instance",
						startTask: options.startTask,
					}) as any,
			)

			// Call createTaskFromHistoryItem with shouldStart: true
			const task = await (provider as any).createTaskFromHistoryItem(incompleteTaskHistory, true)

			// Verify that the task was created with startTask: true (because it's not completed)
			expect(mockTaskConstructor).toHaveBeenCalledWith(
				expect.objectContaining({
					startTask: true, // Should be true for incomplete tasks
				}),
			)
		})
	})

	describe("removeClineFromStack", () => {
		it("should log stack information when removing tasks", async () => {
			const mockTask = {
				taskId: "test-task-id",
				instanceId: "test-instance",
				emit: vi.fn(),
				abortTask: vi.fn(),
				abort: false,
				abandoned: false,
			} as any

			;(provider as any).clineStack = [mockTask]
			;(provider as any).taskEventListeners = new WeakMap()

			const logSpy = vi.spyOn(provider, "log")

			await (provider as any).removeClineFromStack()

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("Removing task test-task-id.test-instance from stack"),
			)
			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Remaining stack size: 0"))
		})

		it("should handle empty stack gracefully", async () => {
			;(provider as any).clineStack = []

			const logSpy = vi.spyOn(provider, "log")

			await (provider as any).removeClineFromStack()

			expect(logSpy).toHaveBeenCalledWith("[removeClineFromStack] Stack is already empty")
		})
	})
})
