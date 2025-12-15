// npx vitest src/core/webview/__tests__/ClineProvider.fork.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import type { HistoryItem } from "@roo-code/types"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../../task-persistence"
import { TelemetryService } from "@roo-code/telemetry"

vi.mock("vscode", () => ({
	Uri: {
		file: (path: string) => ({ fsPath: path }),
		joinPath: vi.fn(),
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
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
		workspaceFolders: [],
	},
	env: {
		uriScheme: "vscode",
		language: "en",
	},
}))

vi.mock("../../task-persistence")
vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		getAllTerminals: vi.fn().mockReturnValue([]),
	},
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options: any) => ({
		taskId: options?.historyItem?.id || "test-task-id",
		emit: vi.fn(),
		abortTask: vi.fn(),
	})),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

describe("ClineProvider.forkCurrentTask()", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		// Initialize TelemetryService
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Create mock context
		mockContext = {
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				setKeysForSync: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				onDidChange: vi.fn(),
			},
			subscriptions: [],
			extensionUri: vscode.Uri.file("/test/extension"),
			extensionPath: "/test/extension",
			globalStorageUri: vscode.Uri.file("/test/storage"),
			storageUri: vscode.Uri.file("/test/workspace-storage"),
			logUri: vscode.Uri.file("/test/logs"),
			extensionMode: vscode.ExtensionMode.Test,
		} as any

		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as any

		mockContextProxy = new ContextProxy(mockContext)
		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", mockContextProxy)

		// Mock file system operations
		vi.mocked(readTaskMessages).mockResolvedValue([
			{ type: "say", say: "text", text: "Hello", ts: 1000 },
			{ type: "ask", ask: "completion_result", text: "Done", ts: 2000 },
		] as any)

		vi.mocked(readApiMessages).mockResolvedValue([
			{ role: "user", content: [{ type: "text", text: "Hello" }], ts: 1000 },
			{ role: "assistant", content: [{ type: "text", text: "Response" }], ts: 1500 },
		] as any)

		vi.mocked(saveTaskMessages).mockResolvedValue()
		vi.mocked(saveApiMessages).mockResolvedValue()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should fork current task and create an exact copy", async () => {
		// Setup: Create a mock current task
		const originalHistoryItem: HistoryItem = {
			id: "task-123",
			number: 1,
			ts: 1000,
			task: "Original task",
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.05,
			mode: "code",
			workspace: "/test/workspace",
		}

		// Mock getTaskWithId to return the original task
		vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: originalHistoryItem,
			taskDirPath: "/test/storage/tasks/task-123",
		})

		// Mock getCurrentTask to return a task
		vi.spyOn(provider, "getCurrentTask").mockReturnValue({
			taskId: "task-123",
		} as any)

		// Mock updateTaskHistory
		vi.spyOn(provider as any, "updateTaskHistory").mockResolvedValue([])

		// Mock createTaskWithHistoryItem
		vi.spyOn(provider as any, "createTaskWithHistoryItem").mockResolvedValue({
			taskId: "new-task-id",
		})

		// Mock postMessageToWebview
		vi.spyOn(provider as any, "postMessageToWebview").mockResolvedValue(undefined)

		// Execute fork
		const newTaskId = await provider.forkCurrentTask()

		// Assertions
		expect(newTaskId).toBeDefined()
		expect(readTaskMessages).toHaveBeenCalledWith({
			taskId: "task-123",
			globalStoragePath: "/test/storage",
		})
		expect(readApiMessages).toHaveBeenCalledWith({
			taskId: "task-123",
			globalStoragePath: "/test/storage",
		})

		// Verify messages were saved with new task ID
		expect(saveTaskMessages).toHaveBeenCalledWith({
			messages: expect.any(Array),
			taskId: expect.stringMatching(/^\d+$/), // New timestamp-based ID
			globalStoragePath: "/test/storage",
		})

		expect(saveApiMessages).toHaveBeenCalledWith({
			messages: expect.any(Array),
			taskId: expect.stringMatching(/^\d+$/), // New timestamp-based ID
			globalStoragePath: "/test/storage",
		})

		// Verify new history item was created with forkedFromTaskId
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				forkedFromTaskId: "task-123",
				tokensIn: 100,
				tokensOut: 50,
				totalCost: 0.05,
				mode: "code",
			}),
		)

		// Verify switch to new task
		expect(provider.createTaskWithHistoryItem).toHaveBeenCalledWith(
			expect.objectContaining({
				forkedFromTaskId: "task-123",
			}),
		)

		// Verify success message posted
		expect(provider.postMessageToWebview).toHaveBeenCalledWith({
			type: "taskForked",
			taskId: newTaskId,
			forkedFromTaskId: "task-123",
		})
	})

	it("should reset delegation fields in forked task", async () => {
		// Setup: Task with delegation metadata
		const delegatedHistoryItem: HistoryItem = {
			id: "task-456",
			number: 1,
			ts: 1000,
			task: "Delegated task",
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.05,
			status: "delegated",
			delegatedToId: "child-task-1",
			awaitingChildId: "child-task-1",
			childIds: ["child-task-1"],
			completedByChildId: "child-task-1",
			completionResultSummary: "Child completed",
		}

		vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: delegatedHistoryItem,
		})
		vi.spyOn(provider, "getCurrentTask").mockReturnValue({ taskId: "task-456" } as any)
		vi.spyOn(provider as any, "updateTaskHistory").mockResolvedValue([])
		vi.spyOn(provider as any, "createTaskWithHistoryItem").mockResolvedValue({})
		vi.spyOn(provider as any, "postMessageToWebview").mockResolvedValue(undefined)

		await provider.forkCurrentTask()

		// Verify delegation fields are reset
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				forkedFromTaskId: "task-456",
				status: undefined,
				delegatedToId: undefined,
				awaitingChildId: undefined,
				completedByChildId: undefined,
				completionResultSummary: undefined,
				// childIds should not be present (not copied)
			}),
		)
	})

	it("should preserve parent/root relationships", async () => {
		// Setup: Task with parent/root relationships
		const subtaskHistoryItem: HistoryItem = {
			id: "task-789",
			number: 2,
			ts: 1000,
			task: "Subtask",
			tokensIn: 50,
			tokensOut: 25,
			totalCost: 0.02,
			parentTaskId: "parent-task",
			rootTaskId: "root-task",
		}

		vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: subtaskHistoryItem,
		})
		vi.spyOn(provider, "getCurrentTask").mockReturnValue({ taskId: "task-789" } as any)
		vi.spyOn(provider as any, "updateTaskHistory").mockResolvedValue([])
		vi.spyOn(provider as any, "createTaskWithHistoryItem").mockResolvedValue({})
		vi.spyOn(provider as any, "postMessageToWebview").mockResolvedValue(undefined)

		await provider.forkCurrentTask()

		// Verify parent/root relationships are preserved
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				parentTaskId: "parent-task",
				rootTaskId: "root-task",
				forkedFromTaskId: "task-789",
			}),
		)
	})

	it("should throw error when no current task exists", async () => {
		vi.spyOn(provider, "getCurrentTask").mockReturnValue(undefined)

		await expect(provider.forkCurrentTask()).rejects.toThrow("No current task to fork")
	})

	it("should clean up partial fork on error", async () => {
		const originalHistoryItem: HistoryItem = {
			id: "task-error",
			number: 1,
			ts: 1000,
			task: "Error task",
			tokensIn: 100,
			tokensOut: 50,
			totalCost: 0.05,
		}

		vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: originalHistoryItem,
		})
		vi.spyOn(provider, "getCurrentTask").mockReturnValue({ taskId: "task-error" } as any)

		// Make saveApiMessages fail
		vi.mocked(saveApiMessages).mockRejectedValue(new Error("Disk full"))

		// Mock deleteTaskWithId for cleanup
		vi.spyOn(provider as any, "deleteTaskWithId").mockResolvedValue(undefined)

		await expect(provider.forkCurrentTask()).rejects.toThrow("Failed to fork task: Disk full")

		// Verify cleanup was attempted
		expect(provider.deleteTaskWithId).toHaveBeenCalled()
	})

	it("should copy all task state including tokens and cost", async () => {
		const fullStateHistoryItem: HistoryItem = {
			id: "task-full",
			number: 1,
			ts: 1000,
			task: "Full state task",
			tokensIn: 5000,
			tokensOut: 3000,
			cacheWrites: 2000,
			cacheReads: 1000,
			totalCost: 0.15,
			size: 1024,
			workspace: "/test/workspace",
			mode: "architect",
		}

		vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
			historyItem: fullStateHistoryItem,
		})
		vi.spyOn(provider, "getCurrentTask").mockReturnValue({ taskId: "task-full" } as any)
		vi.spyOn(provider as any, "updateTaskHistory").mockResolvedValue([])
		vi.spyOn(provider as any, "createTaskWithHistoryItem").mockResolvedValue({})
		vi.spyOn(provider as any, "postMessageToWebview").mockResolvedValue(undefined)

		await provider.forkCurrentTask()

		// Verify all state is preserved
		expect(provider.updateTaskHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				tokensIn: 5000,
				tokensOut: 3000,
				cacheWrites: 2000,
				cacheReads: 1000,
				totalCost: 0.15,
				size: 1024,
				workspace: "/test/workspace",
				mode: "architect",
				forkedFromTaskId: "task-full",
			}),
		)
	})
})
