// npx vitest core/webview/__tests__/ClineProvider.subtask-rehydration.spec.ts

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"
import { TelemetryService } from "@roo-code/telemetry"

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../../utils/safeWriteJson")
vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			initializeFilePaths: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
			info: { supportsComputerUse: false },
		}),
	}),
}))

vi.mock("../../../shared/modes", () => ({
	modes: [],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	defaultModeSlug: "code",
}))

vi.mock("../../prompts/sections/custom-instructions", () => ({
	addCustomInstructions: vi.fn().mockResolvedValue("Combined instructions"),
}))

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
		get instance() {
			return {
				isAuthenticated: vi.fn().mockReturnValue(false),
			}
		},
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockImplementation(async () => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const lines = content.split("\n")
		return lines.map((line, index) => `${index + 1} | ${line}`).join("\n")
	}),
}))

vi.mock("../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
}))

vi.mock("../diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getToolDescription: () => "test",
		getName: () => "test-strategy",
		applyDiff: vi.fn(),
	})),
}))

vi.mock("delay", () => {
	const delayFn = () => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
	codeMode: "code",
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
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
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
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
}))

describe("ClineProvider - Subtask Rehydration", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView

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
				get: vi.fn().mockImplementation((key: string) => Promise.resolve(secrets[key])),
				store: vi.fn().mockImplementation((key: string, value: string) => {
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

		mockWebviewView = {
			webview: {
				postMessage: vi.fn(),
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
			},
			visible: true,
			onDidDispose: vi.fn(),
			onDidChangeVisibility: vi.fn(),
		} as unknown as vscode.WebviewView

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Mock getMcpHub to avoid errors
		provider.getMcpHub = vi.fn().mockReturnValue(null)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("finishSubTask", () => {
		test("should complete subtask when parent is on stack", async () => {
			// Create parent and child tasks
			const parentTask = {
				taskId: "parent-task-id",
				completeSubtask: vi.fn().mockResolvedValue(undefined),
				parentTaskId: undefined,
				emit: vi.fn(),
			} as any

			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add tasks to stack
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(childTask)

			// Call finishSubTask
			await provider.finishSubTask("Task completed")

			// Verify child was removed from stack
			expect(provider.getTaskStackSize()).toBe(1)
			expect(provider.getCurrentTask()).toBe(parentTask)

			// Verify parent's completeSubtask was called
			expect(parentTask.completeSubtask).toHaveBeenCalledWith("Task completed")
		})

		test("should rehydrate parent when not on stack after reload", async () => {
			// Create child task without parent on stack
			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: undefined, // No parent reference after reload
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add only child to stack (simulating post-reload state)
			await provider.addClineToStack(childTask)

			// Mock getTaskWithId to return parent history
			const mockHistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				mode: "code",
			}
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: mockHistoryItem,
			})

			// Mock createTaskWithHistoryItem to create parent task
			const rehydratedParentTask = {
				taskId: "parent-task-id",
				completeSubtask: vi.fn().mockResolvedValue(undefined),
				parentTaskId: undefined,
				emit: vi.fn(),
			} as any
			;(provider as any).createTaskWithHistoryItem = vi.fn().mockResolvedValue(rehydratedParentTask)

			// Spy on log method to verify rehydration message
			const logSpy = vi.spyOn(provider, "log")

			// Call finishSubTask
			await provider.finishSubTask("Task completed")

			// Verify getTaskWithId was called with parent ID
			expect((provider as any).getTaskWithId).toHaveBeenCalledWith("parent-task-id")

			// Verify createTaskWithHistoryItem was called
			expect((provider as any).createTaskWithHistoryItem).toHaveBeenCalledWith(mockHistoryItem)

			// Verify rehydration was logged
			expect(logSpy).toHaveBeenCalledWith("[finishSubTask] Rehydrated parent task parent-task-id from history")

			// Verify parent's completeSubtask was called
			expect(rehydratedParentTask.completeSubtask).toHaveBeenCalledWith("Task completed")
		})

		test("should handle rehydration failure gracefully", async () => {
			// Create child task without parent on stack
			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: undefined,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add only child to stack
			await provider.addClineToStack(childTask)

			// Mock getTaskWithId to throw error
			;(provider as any).getTaskWithId = vi.fn().mockRejectedValue(new Error("Parent task not found"))

			// Spy on log method to verify error logging
			const logSpy = vi.spyOn(provider, "log")

			// Call finishSubTask - should not throw
			await expect(provider.finishSubTask("Task completed")).resolves.not.toThrow()

			// Verify error was logged
			expect(logSpy).toHaveBeenCalledWith(
				"[finishSubTask] Failed to rehydrate parent task parent-task-id: Error: Parent task not found",
			)

			// Verify child was still removed from stack
			expect(provider.getTaskStackSize()).toBe(0)
		})

		test("should handle case when no parentTaskId exists", async () => {
			// Create task without parent ID (regular task)
			const regularTask = {
				taskId: "regular-task-id",
				parentTaskId: undefined,
				parentTask: undefined,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add to stack
			await provider.addClineToStack(regularTask)

			// Mock getTaskWithId (should not be called)
			;(provider as any).getTaskWithId = vi.fn()

			// Call finishSubTask
			await provider.finishSubTask("Task completed")

			// Verify getTaskWithId was NOT called
			expect((provider as any).getTaskWithId).not.toHaveBeenCalled()

			// Verify task was removed from stack
			expect(provider.getTaskStackSize()).toBe(0)
		})

		test("should handle multi-level subtask chains", async () => {
			// Create grandparent, parent, and child tasks
			const grandparentTask = {
				taskId: "grandparent-task-id",
				completeSubtask: vi.fn().mockResolvedValue(undefined),
				parentTaskId: undefined,
				emit: vi.fn(),
			} as any

			const parentTask = {
				taskId: "parent-task-id",
				parentTaskId: "grandparent-task-id",
				parentTask: grandparentTask,
				completeSubtask: vi.fn().mockResolvedValue(undefined),
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: parentTask,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add all tasks to stack
			await provider.addClineToStack(grandparentTask)
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(childTask)

			// Call finishSubTask on child
			await provider.finishSubTask("Child task completed")

			// Verify only child was removed, parent is now current
			expect(provider.getTaskStackSize()).toBe(2)
			expect(provider.getCurrentTask()).toBe(parentTask)

			// Verify parent's completeSubtask was called
			expect(parentTask.completeSubtask).toHaveBeenCalledWith("Child task completed")
			expect(grandparentTask.completeSubtask).not.toHaveBeenCalled()
		})

		test("should handle rehydration with missing parent history", async () => {
			// Create child task without parent on stack
			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: undefined,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add only child to stack
			await provider.addClineToStack(childTask)

			// Mock getTaskWithId to return null (parent history not found)
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue(null)

			// Spy on log method
			const logSpy = vi.spyOn(provider, "log")

			// Call finishSubTask
			await provider.finishSubTask("Task completed")

			// Verify error was logged
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Failed to rehydrate parent task parent-task-id"),
			)

			// Verify child was still removed
			expect(provider.getTaskStackSize()).toBe(0)
		})

		test("should preserve message when rehydrating parent", async () => {
			// Create child task without parent on stack
			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: undefined,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Add only child to stack
			await provider.addClineToStack(childTask)

			// Mock getTaskWithId
			const mockHistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
			}
			;(provider as any).getTaskWithId = vi.fn().mockResolvedValue({
				historyItem: mockHistoryItem,
			})

			// Mock createTaskWithHistoryItem
			const rehydratedParentTask = {
				taskId: "parent-task-id",
				completeSubtask: vi.fn().mockResolvedValue(undefined),
				emit: vi.fn(),
			} as any
			;(provider as any).createTaskWithHistoryItem = vi.fn().mockResolvedValue(rehydratedParentTask)

			const testMessage = "Subtask completed with specific result"

			// Call finishSubTask with specific message
			await provider.finishSubTask(testMessage)

			// Verify the exact message was passed to parent
			expect(rehydratedParentTask.completeSubtask).toHaveBeenCalledWith(testMessage)
		})
	})

	describe("clearTask message handler with parentTaskId", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("should call finishSubTask when task has parentTaskId but no parentTask", async () => {
			// Create child task with parentTaskId but no parentTask reference
			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: undefined, // No parent reference (post-reload scenario)
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Mock provider methods
			const finishSubTaskSpy = vi.spyOn(provider, "finishSubTask").mockResolvedValue(undefined)
			const clearTaskSpy = vi.spyOn(provider, "clearTask").mockResolvedValue(undefined)
			const postStateToWebviewSpy = vi.spyOn(provider, "postStateToWebview").mockResolvedValue(undefined)

			// Add task to stack
			await provider.addClineToStack(childTask)

			// Get the message handler
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Trigger clearTask message
			await messageHandler({ type: "clearTask" })

			// Verify finishSubTask was called (not clearTask)
			expect(finishSubTaskSpy).toHaveBeenCalledWith(expect.stringContaining("canceled"))
			expect(clearTaskSpy).not.toHaveBeenCalled()
			expect(postStateToWebviewSpy).toHaveBeenCalled()
		})

		test("should call finishSubTask when task has both parentTask and parentTaskId", async () => {
			// Create parent and child tasks
			const parentTask = {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(),
				emit: vi.fn(),
			} as any

			const childTask = {
				taskId: "child-task-id",
				parentTaskId: "parent-task-id",
				parentTask: parentTask, // Has parent reference
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Mock provider methods
			const finishSubTaskSpy = vi.spyOn(provider, "finishSubTask").mockResolvedValue(undefined)
			const clearTaskSpy = vi.spyOn(provider, "clearTask").mockResolvedValue(undefined)

			// Add tasks to stack
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(childTask)

			// Get the message handler
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Trigger clearTask message
			await messageHandler({ type: "clearTask" })

			// Verify finishSubTask was called
			expect(finishSubTaskSpy).toHaveBeenCalledWith(expect.stringContaining("canceled"))
			expect(clearTaskSpy).not.toHaveBeenCalled()
		})

		test("should call clearTask when task has neither parentTask nor parentTaskId", async () => {
			// Create regular task without parent
			const regularTask = {
				taskId: "regular-task-id",
				parentTaskId: undefined,
				parentTask: undefined,
				abortTask: vi.fn(),
				emit: vi.fn(),
			} as any

			// Mock provider methods
			const finishSubTaskSpy = vi.spyOn(provider, "finishSubTask").mockResolvedValue(undefined)
			const clearTaskSpy = vi.spyOn(provider, "clearTask").mockResolvedValue(undefined)

			// Add task to stack
			await provider.addClineToStack(regularTask)

			// Get the message handler
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Trigger clearTask message
			await messageHandler({ type: "clearTask" })

			// Verify clearTask was called (not finishSubTask)
			expect(clearTaskSpy).toHaveBeenCalled()
			expect(finishSubTaskSpy).not.toHaveBeenCalled()
		})
	})
})
