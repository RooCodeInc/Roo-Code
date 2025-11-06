// npx vitest core/webview/__tests__/ClineProvider.finishSubTask.spec.ts

/**
 * Test suite for ClineProvider.finishSubTask() method
 *
 * This test validates the fix for TASK-INTR-003, which ensures that subtasks
 * properly boomerang back to their parent task after interruption and resume.
 *
 * Critical scenarios tested:
 * 1. Fresh subtask completion (parent in stack)
 * 2. Resumed subtask completion (parent NOT in stack - the fixed scenario)
 * 3. Error handling when parent restoration fails
 * 4. Auto-approval timeout handling
 */

// Mock dependencies BEFORE imports
vi.mock("p-wait-for", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
	rm: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("delay", () => {
	const delayFn = (_ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

vi.mock("../../../utils/git", () => ({
	getWorkspaceGitInfo: vi.fn().mockResolvedValue({}),
}))

vi.mock("../../task-persistence", () => ({
	readTaskMessages: vi.fn().mockResolvedValue([]),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../integrations/misc/export-markdown", () => ({
	downloadTask: vi.fn(),
}))

vi.mock("../../../integrations/theme/getTheme", () => ({
	getTheme: vi.fn().mockResolvedValue({ name: "dark" }),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue(""),
}))

vi.mock("pdf-parse", () => ({
	default: vi.fn().mockResolvedValue({ text: "" }),
}))

vi.mock("mammoth", () => ({
	default: {
		extractRawText: vi.fn().mockResolvedValue({ value: "" }),
	},
}))

vi.mock("../../../services/mcp/McpHub", () => ({
	McpHub: vi.fn().mockImplementation(() => ({
		registerClient: vi.fn(),
		unregisterClient: vi.fn(),
		getAllServers: vi.fn().mockReturnValue([]),
	})),
}))

vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue({
			registerClient: vi.fn(),
			unregisterClient: vi.fn(),
		}),
		unregisterProvider: vi.fn(),
	},
}))

vi.mock("../../../services/marketplace", () => ({
	MarketplaceManager: vi.fn().mockImplementation(() => ({
		cleanup: vi.fn(),
	})),
}))

vi.mock("../../../services/checkpoints/ShadowCheckpointService", () => ({
	ShadowCheckpointService: {
		deleteTask: vi.fn().mockResolvedValue(undefined),
	},
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
	})),
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))

vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockImplementation(async () => "mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../prompts/sections/custom-instructions", () => ({
	addCustomInstructions: vi.fn().mockResolvedValue("Combined instructions"),
}))

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(false),
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://api.roocode.com"),
}))

vi.mock("../../../shared/modes", () => ({
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	defaultModeSlug: "code",
}))

// Mock Task class
vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation(() => ({
		taskId: "test-task-id",
		instanceId: "test-instance-id",
		parentTaskId: undefined,
		parentTask: undefined,
		rootTask: undefined,
		taskAsk: undefined,
		abortTask: vi.fn(),
		completeSubtask: vi.fn(),
		approveAsk: vi.fn(),
		emit: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
	})),
}))

vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		workspaceFolders: [],
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	Uri: {
		file: vi.fn(),
		joinPath: vi.fn(),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
		machineId: "test-machine-id",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
}))

// Now import the modules
import * as vscode from "vscode"
import pWaitFor from "p-wait-for"

import { type HistoryItem } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"

describe("ClineProvider.finishSubTask", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let parentTask: any
	let subtask: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Initialize TelemetryService
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Create mock context
		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		// Create mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		// Create provider
		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Spy on provider methods
		vi.spyOn(provider, "log")

		// Create parent and child tasks
		parentTask = new Task({
			provider,
			apiConfiguration: { apiProvider: "anthropic" },
		})
		Object.assign(parentTask, {
			taskId: "parent-task-id",
			instanceId: "parent-instance-id",
			taskAsk: undefined,
			completeSubtask: vi.fn(),
			approveAsk: vi.fn(),
		})

		subtask = new Task({
			provider,
			apiConfiguration: { apiProvider: "anthropic" },
		})
		Object.assign(subtask, {
			taskId: "subtask-id",
			instanceId: "subtask-instance-id",
			parentTaskId: "parent-task-id",
			parentTask: parentTask,
			rootTask: parentTask,
		})
	})

	describe("Scenario 1: Fresh subtask completion (parent in stack)", () => {
		it("should call completeSubtask on parent when parent is in stack", async () => {
			// Setup: Add both parent and subtask to stack (simulating fresh subtask)
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			// Spy on postMessageToWebview
			const postMessageSpy = vi.spyOn(provider as any, "postMessageToWebview")

			// Verify stack setup
			expect(provider.getTaskStackSize()).toBe(2)
			expect(provider.getCurrentTask()?.taskId).toBe("subtask-id")

			// Execute: Complete the subtask
			await provider.finishSubTask("Subtask completed successfully")

			// Verify: Parent's completeSubtask was called
			expect(parentTask.completeSubtask).toHaveBeenCalledWith("Subtask completed successfully")

			// Verify: Stack now only has parent
			expect(provider.getTaskStackSize()).toBe(1)
			expect(provider.getCurrentTask()?.taskId).toBe("parent-task-id")

			// Verify: No parent restoration occurred
			expect(provider.log).toHaveBeenCalledWith(expect.stringContaining("[finishSubTask] Parent found in stack"))

			// Verify: UI navigation action was sent to switch to parent task
			expect(postMessageSpy).toHaveBeenCalledWith({
				type: "action",
				action: "chatButtonClicked",
			})
		})

		it("should handle subtask completion without errors", async () => {
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			// Should not throw
			await expect(provider.finishSubTask("Task done")).resolves.not.toThrow()

			// Verify stack state is correct
			expect(provider.getTaskStackSize()).toBe(1)
		})
	})

	describe("Scenario 2: Resumed subtask completion (parent NOT in stack) ⭐", () => {
		it("should restore parent from history and complete subtask", async () => {
			// Setup: Only subtask in stack (simulating resumed subtask after VSCode restart)
			await provider.addClineToStack(subtask)

			// Spy on postMessageToWebview
			const postMessageSpy = vi.spyOn(provider as any, "postMessageToWebview")

			// Mock getTaskWithId to return parent history
			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
				taskDirPath: "/test/task/dir",
				apiConversationHistoryFilePath: "/test/api.json",
				uiMessagesFilePath: "/test/ui.json",
				apiConversationHistory: [],
			})

			// Mock createTaskWithHistoryItem to add parent to stack and return it
			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})
			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				instanceId: "restored-parent-instance",
				taskAsk: { ask: "resume_task" },
				completeSubtask: vi.fn(),
				approveAsk: vi.fn(),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				// Simulate adding parent to stack (this happens in createTaskWithHistoryItem)
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			// Mock pWaitFor to resolve immediately (both calls)
			vi.mocked(pWaitFor).mockResolvedValue(undefined)

			// Execute: Complete the subtask
			await provider.finishSubTask("Subtask completed")

			// Verify: Parent was fetched from history
			expect((provider as any).getTaskWithId).toHaveBeenCalledWith("parent-task-id")

			// Verify: Parent was restored via createTaskWithHistoryItem
			expect((provider as any).createTaskWithHistoryItem).toHaveBeenCalledWith(parentHistoryItem)

			// Verify: completeSubtask was called on restored parent
			expect(restoredParent.completeSubtask).toHaveBeenCalledWith("Subtask completed")

			// Verify: Auto-approval logic was triggered (2 pWaitFor calls now)
			expect(pWaitFor).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: 3000 }))

			// Verify: approveAsk was called on restored parent
			expect(restoredParent.approveAsk).toHaveBeenCalled()

			// Verify: Logs confirm restoration
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Parent not in stack, restoring from history"),
			)
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Parent task parent-task-id restored and on stack"),
			)

			// Verify: UI navigation action was sent to switch to restored parent task
			expect(postMessageSpy).toHaveBeenCalledWith({
				type: "action",
				action: "chatButtonClicked",
			})
		})

		it("should wait for resume_task ask before auto-approving", async () => {
			await provider.addClineToStack(subtask)

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			// Use Object.defineProperty for read-only taskAsk property
			let currentAsk: any = undefined
			Object.defineProperty(restoredParent, "taskAsk", {
				get: () => currentAsk,
				configurable: true,
			})

			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(),
				approveAsk: vi.fn(),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			// Mock pWaitFor - first call waits for parent on stack, second for resume ask
			let pWaitForCallCount = 0
			vi.mocked(pWaitFor).mockImplementation(async (condition: any) => {
				pWaitForCallCount++
				if (pWaitForCallCount === 1) {
					// First call: waiting for parent on stack - should succeed immediately
					return undefined
				} else {
					// Second call: waiting for resume ask - simulate ask appearing
					currentAsk = { ask: "resume_task" }
					const result = condition()
					if (!result) {
						throw new Error("Condition not met")
					}
					return undefined
				}
			})

			await provider.finishSubTask("Subtask done")

			// Verify the condition in second pWaitFor call checks for resume ask
			expect(pWaitFor).toHaveBeenCalledTimes(2)
			const secondConditionFn = vi.mocked(pWaitFor).mock.calls[1][0]

			// Test that condition returns false when no ask
			currentAsk = undefined
			expect(secondConditionFn()).toBe(false)

			// Test that condition returns true with resume_task
			currentAsk = { ask: "resume_task" }
			expect(secondConditionFn()).toBe(true)

			// Test that condition returns true with resume_completed_task
			currentAsk = { ask: "resume_completed_task" }
			expect(secondConditionFn()).toBe(true)

			expect(restoredParent.approveAsk).toHaveBeenCalled()
		})
	})

	describe("Scenario 3: Parent task deleted (error handling)", () => {
		it("should handle parent restoration failure gracefully", async () => {
			await provider.addClineToStack(subtask)

			// Mock getTaskWithId to throw error (parent not found)
			vi.spyOn(provider as any, "getTaskWithId").mockRejectedValue(new Error("Task not found"))

			// Execute: Try to complete subtask with missing parent
			await provider.finishSubTask("Subtask completed")

			// Verify: Error was logged
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Failed to restore parent: Task not found"),
			)

			// Verify: User was shown error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Failed to return to parent task: Task not found"),
			)

			// Verify: Subtask was still removed from stack
			expect(provider.getTaskStackSize()).toBe(0)
		})

		it("should handle createTaskWithHistoryItem failure", async () => {
			await provider.addClineToStack(subtask)

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			// Mock createTaskWithHistoryItem to not add parent to stack (simulating timeout)
			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				// Don't add to stack - will cause timeout waiting for parent
				return null
			})

			// Mock pWaitFor first call to timeout
			vi.mocked(pWaitFor).mockReturnValue(Promise.reject(new Error("Timeout")).catch(() => undefined) as any)

			await provider.finishSubTask("Subtask completed")

			// Verify: Error was logged
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining(
					"[finishSubTask] Failed to restore parent - not on stack after restore attempt",
				),
			)

			// Verify: User was shown error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining("Failed to return to parent task: Parent task could not be restored"),
			)
		})
	})

	describe("Scenario 4: Auto-approval timeout (edge case)", () => {
		it("should handle auto-approval timeout gracefully", async () => {
			await provider.addClineToStack(subtask)

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			// Use Object.defineProperty for read-only taskAsk property
			Object.defineProperty(restoredParent, "taskAsk", {
				value: undefined, // Never sets ask (simulating timeout)
				writable: false,
				configurable: true,
			})

			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(),
				approveAsk: vi.fn(),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			// Mock pWaitFor - first call succeeds (parent on stack), second times out (resume ask)
			let pWaitForCallCount = 0
			vi.mocked(pWaitFor).mockImplementation(async (condition: any) => {
				pWaitForCallCount++
				if (pWaitForCallCount === 1) {
					// First call: waiting for parent on stack - succeeds
					return undefined
				} else {
					// Second call: waiting for resume ask - timeout
					return Promise.reject(new Error("Timeout")).catch(() => undefined) as any
				}
			})

			// Should not throw despite timeout
			await expect(provider.finishSubTask("Subtask done")).resolves.not.toThrow()

			// Verify: completeSubtask was still called
			expect(restoredParent.completeSubtask).toHaveBeenCalledWith("Subtask done")

			// Verify: approveAsk still gets called (the .catch prevents the error from stopping execution)
			expect(restoredParent.approveAsk).toHaveBeenCalled()

			// Verify: Parent restoration was logged
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Parent not in stack, restoring from history"),
			)
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Parent task parent-task-id restored and on stack"),
			)
		})

		it("should continue execution after auto-approval failure", async () => {
			await provider.addClineToStack(subtask)

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			// Use Object.defineProperty for read-only taskAsk property
			Object.defineProperty(restoredParent, "taskAsk", {
				value: { ask: "resume_task" },
				writable: false,
				configurable: true,
			})

			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(),
				approveAsk: vi.fn().mockRejectedValue(new Error("Approval failed")),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			// Mock pWaitFor - both calls succeed but approveAsk throws
			vi.mocked(pWaitFor).mockResolvedValue(undefined)

			// Should handle approval failure gracefully
			await expect(provider.finishSubTask("Done")).resolves.not.toThrow()

			// Verify: completeSubtask was called despite approval failure
			expect(restoredParent.completeSubtask).toHaveBeenCalled()
		})
	})

	describe("Edge cases", () => {
		it("should handle subtask without parent task ID", async () => {
			// Create subtask without parent
			const orphanSubtask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})
			Object.assign(orphanSubtask, {
				taskId: "orphan-subtask-id",
				parentTaskId: undefined, // No parent
			})

			await provider.addClineToStack(orphanSubtask)

			// Spy on methods
			const getTaskWithIdSpy = vi.spyOn(provider as any, "getTaskWithId")
			const createTaskSpy = vi.spyOn(provider as any, "createTaskWithHistoryItem")
			const postMessageSpy = vi.spyOn(provider as any, "postMessageToWebview")

			// Should complete without errors
			await expect(provider.finishSubTask("Done")).resolves.not.toThrow()

			// Verify: No parent restoration attempted
			expect(getTaskWithIdSpy).not.toHaveBeenCalled()
			expect(createTaskSpy).not.toHaveBeenCalled()

			// Verify: Stack is empty
			expect(provider.getTaskStackSize()).toBe(0)

			// Verify: NO UI navigation action sent (no parent to switch to)
			expect(postMessageSpy).not.toHaveBeenCalledWith({
				type: "action",
				action: "chatButtonClicked",
			})
		})

		it("should log all major steps during execution", async () => {
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			await provider.finishSubTask("Test message")

			// Verify comprehensive logging
			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Finishing subtask subtask-id, parent: parent-task-id"),
			)
			expect(provider.log).toHaveBeenCalledWith(expect.stringContaining("[finishSubTask] Parent found in stack"))
		})

		it("should handle resumed case with resume_completed_task ask", async () => {
			await provider.addClineToStack(subtask)

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			// Use Object.defineProperty for read-only taskAsk property
			Object.defineProperty(restoredParent, "taskAsk", {
				value: { ask: "resume_completed_task" },
				writable: false,
				configurable: true,
			})

			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(),
				approveAsk: vi.fn(),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			// Mock both pWaitFor calls
			let pWaitForCallCount = 0
			vi.mocked(pWaitFor).mockImplementation(async (condition: any) => {
				pWaitForCallCount++
				if (pWaitForCallCount === 2) {
					// Second call: condition should accept resume_completed_task
					expect(condition()).toBe(true)
				}
				return undefined
			})

			await provider.finishSubTask("Done")

			expect(restoredParent.approveAsk).toHaveBeenCalled()
		})
	})

	describe("Integration scenarios", () => {
		it("should maintain proper stack state throughout process", async () => {
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			// Initial state
			expect(provider.getTaskStackSize()).toBe(2)
			expect(provider.getCurrentTask()?.taskId).toBe("subtask-id")

			// Complete subtask
			await provider.finishSubTask("Completed")

			// Final state
			expect(provider.getTaskStackSize()).toBe(1)
			expect(provider.getCurrentTask()?.taskId).toBe("parent-task-id")
		})

		it("should handle nested subtasks correctly", async () => {
			// Create grandparent -> parent -> subtask chain
			const grandparentTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})
			Object.assign(grandparentTask, {
				taskId: "grandparent-id",
				completeSubtask: vi.fn(),
			})

			const middleTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})
			Object.assign(middleTask, {
				taskId: "middle-id",
				parentTaskId: "grandparent-id",
				parentTask: grandparentTask,
				completeSubtask: vi.fn(),
			})

			const leafSubtask = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})
			Object.assign(leafSubtask, {
				taskId: "leaf-id",
				parentTaskId: "middle-id",
				parentTask: middleTask,
			})

			// Add all to stack
			await provider.addClineToStack(grandparentTask)
			await provider.addClineToStack(middleTask)
			await provider.addClineToStack(leafSubtask)

			expect(provider.getTaskStackSize()).toBe(3)

			// Complete leaf subtask
			await provider.finishSubTask("Leaf done")

			// Verify: Middle task resumed
			expect(provider.getTaskStackSize()).toBe(2)
			expect(provider.getCurrentTask()?.taskId).toBe("middle-id")
			expect(middleTask.completeSubtask).toHaveBeenCalledWith("Leaf done")
		})
	})

	describe("Regression prevention", () => {
		it("should not break fresh subtask behavior after fix", async () => {
			// This test ensures the fix doesn't regress the existing fresh subtask flow
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			const getTaskWithIdSpy = vi.spyOn(provider as any, "getTaskWithId")
			const createTaskSpy = vi.spyOn(provider as any, "createTaskWithHistoryItem")

			await provider.finishSubTask("Fresh subtask done")

			// Verify: Parent restoration NOT attempted (parent was in stack)
			expect(getTaskWithIdSpy).not.toHaveBeenCalled()
			expect(createTaskSpy).not.toHaveBeenCalled()

			// Verify: Direct completeSubtask call
			expect(parentTask.completeSubtask).toHaveBeenCalledWith("Fresh subtask done")
		})

		it("should handle empty stack gracefully", async () => {
			// No tasks in stack at all
			expect(provider.getTaskStackSize()).toBe(0)

			// Should not throw
			await expect(provider.finishSubTask("Done")).resolves.not.toThrow()

			// Verify: No operations attempted
			expect(parentTask.completeSubtask).not.toHaveBeenCalled()
		})
	})

	describe("Auto-approval logic details", () => {
		it("should use 3 second timeout for auto-approval", async () => {
			await provider.addClineToStack(subtask)

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			// Use Object.defineProperty for read-only taskAsk property
			Object.defineProperty(restoredParent, "taskAsk", {
				value: { ask: "resume_task" },
				writable: false,
				configurable: true,
			})

			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(),
				approveAsk: vi.fn(),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			vi.mocked(pWaitFor).mockResolvedValue(undefined)

			await provider.finishSubTask("Done")

			// Verify: Both pWaitFor calls use 3000ms timeout
			expect(pWaitFor).toHaveBeenCalledTimes(2)
			expect(pWaitFor).toHaveBeenNthCalledWith(1, expect.any(Function), { timeout: 3000 })
			expect(pWaitFor).toHaveBeenNthCalledWith(2, expect.any(Function), { timeout: 3000 })
		})

		it("should only auto-approve for restored parents", async () => {
			// Fresh subtask case - should NOT auto-approve
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			await provider.finishSubTask("Done")

			// Verify: pWaitFor NOT called (no auto-approval for fresh case)
			expect(pWaitFor).not.toHaveBeenCalled()
			expect(parentTask.approveAsk).not.toHaveBeenCalled()
		})
	})

	describe("Error message formatting", () => {
		it("should include error details in user-facing message", async () => {
			await provider.addClineToStack(subtask)

			const errorMessage = "Network timeout: Failed to connect to storage"
			vi.spyOn(provider as any, "getTaskWithId").mockRejectedValue(new Error(errorMessage))

			await provider.finishSubTask("Done")

			// Verify: Full error message shown to user
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				`Failed to return to parent task: ${errorMessage}`,
			)
		})

		it("should handle non-Error objects in catch block", async () => {
			await provider.addClineToStack(subtask)

			// Throw a string instead of Error object
			vi.spyOn(provider as any, "getTaskWithId").mockRejectedValue("String error message")

			await provider.finishSubTask("Done")

			// Verify: String error converted properly
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				"Failed to return to parent task: String error message",
			)

			expect(provider.log).toHaveBeenCalledWith(
				expect.stringContaining("[finishSubTask] Failed to restore parent: String error message"),
			)
		})
	})

	describe("completeSubtask call verification", () => {
		it("should pass the correct last message to completeSubtask", async () => {
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			const lastMessage = "This is the final result of the subtask"
			await provider.finishSubTask(lastMessage)

			expect(parentTask.completeSubtask).toHaveBeenCalledWith(lastMessage)
			expect(parentTask.completeSubtask).toHaveBeenCalledTimes(1)
		})

		it("should call completeSubtask before auto-approval", async () => {
			await provider.addClineToStack(subtask)

			const callOrder: string[] = []

			const parentHistoryItem: HistoryItem = {
				id: "parent-task-id",
				ts: Date.now(),
				task: "Parent task",
				number: 1,
				tokensIn: 0,
				tokensOut: 0,
				totalCost: 0,
			}

			vi.spyOn(provider as any, "getTaskWithId").mockResolvedValue({
				historyItem: parentHistoryItem,
			})

			const restoredParent = new Task({
				provider,
				apiConfiguration: { apiProvider: "anthropic" },
			})

			// Use Object.defineProperty for read-only taskAsk property
			Object.defineProperty(restoredParent, "taskAsk", {
				value: { ask: "resume_task" },
				writable: false,
				configurable: true,
			})

			Object.assign(restoredParent, {
				taskId: "parent-task-id",
				completeSubtask: vi.fn(() => callOrder.push("completeSubtask")),
				approveAsk: vi.fn(() => callOrder.push("approveAsk")),
			})

			vi.spyOn(provider as any, "createTaskWithHistoryItem").mockImplementation(async () => {
				await provider.addClineToStack(restoredParent)
				return restoredParent
			})

			vi.mocked(pWaitFor).mockResolvedValue(undefined)

			await provider.finishSubTask("Done")

			// Verify: completeSubtask called before approveAsk
			expect(callOrder).toEqual(["completeSubtask", "approveAsk"])
		})
	})

	describe("Stack manipulation verification", () => {
		it("should remove subtask before checking for parent", async () => {
			await provider.addClineToStack(parentTask)
			await provider.addClineToStack(subtask)

			// Spy on removeClineFromStack before calling finishSubTask
			const removeSpy = vi.spyOn(provider as any, "removeClineFromStack")

			await provider.finishSubTask("Done")

			// Verify: removeClineFromStack was called
			expect(removeSpy).toHaveBeenCalled()

			// Verify: Stack was properly manipulated (subtask removed, parent remains)
			expect(provider.getTaskStackSize()).toBe(1)
			expect(provider.getCurrentTask()?.taskId).toBe("parent-task-id")
		})
	})
})
