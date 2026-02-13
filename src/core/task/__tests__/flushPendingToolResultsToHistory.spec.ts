// npx vitest run core/task/__tests__/flushPendingToolResultsToHistory.spec.ts

import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

import type { GlobalState, ProviderSettings } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"

// Mock delay before any imports that might use it
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	const mockFunctions = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
	}

	return {
		...actual,
		...mockFunctions,
		default: mockFunctions,
	}
})

const { mockPWaitFor } = vi.hoisted(() => {
	return { mockPWaitFor: vi.fn().mockImplementation(async () => Promise.resolve()) }
})

vi.mock("p-wait-for", () => ({
	default: mockPWaitFor,
}))

vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	const mockEventEmitter = { event: vi.fn(), fire: vi.fn() }
	const mockTextDocument = { uri: { fsPath: "/mock/workspace/path/file.ts" } }
	const mockTextEditor = { document: mockTextDocument }
	const mockTab = { input: { uri: { fsPath: "/mock/workspace/path/file.ts" } } }
	const mockTabGroup = { tabs: [mockTab] }

	return {
		TabInputTextDiff: vi.fn(),
		CodeActionKind: {
			QuickFix: { value: "quickfix" },
			RefactorRewrite: { value: "refactor.rewrite" },
		},
		window: {
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			visibleTextEditors: [mockTextEditor],
			tabGroups: {
				all: [mockTabGroup],
				close: vi.fn(),
				onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			},
			showErrorMessage: vi.fn(),
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: "/mock/workspace/path" },
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
			fs: {
				stat: vi.fn().mockResolvedValue({ type: 1 }),
			},
			onDidSaveTextDocument: vi.fn(() => mockDisposable),
			getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: vi.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: vi.fn(),
		},
		TabInputText: vi.fn(),
	}
})

vi.mock("../../mentions", () => ({
	parseMentions: vi.fn().mockImplementation((text) => {
		return Promise.resolve({ text: `processed: ${text}`, mode: undefined, contentBlocks: [] })
	}),
	openMention: vi.fn(),
	getLatestTerminalOutput: vi.fn(),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")

vi.mock("../../condense", async (importOriginal) => {
	const actual = (await importOriginal()) as any
	return {
		...actual,
		summarizeConversation: vi.fn().mockResolvedValue({
			messages: [{ role: "user", content: [{ type: "text", text: "continued" }], ts: Date.now() }],
			summary: "summary",
			cost: 0,
			newContextTokens: 1,
		}),
	}
})

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(false),
}))

describe("flushPendingToolResultsToHistory", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation((key: keyof GlobalState) => undefined),
				update: vi.fn().mockImplementation((_key, _value) => Promise.resolve()),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockImplementation((_key) => undefined),
				update: vi.fn().mockImplementation((_key, _value) => Promise.resolve()),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockImplementation((_key) => Promise.resolve(undefined)),
				store: vi.fn().mockImplementation((_key, _value) => Promise.resolve()),
				delete: vi.fn().mockImplementation((_key) => Promise.resolve()),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}

		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebviewWithoutTaskHistory = vi.fn().mockResolvedValue(undefined)
		mockProvider.updateTaskHistory = vi.fn().mockResolvedValue(undefined)
	})

	it("should not save anything when userMessageContent is empty", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Ensure userMessageContent is empty
		task.userMessageContent = []
		const initialHistoryLength = task.apiConversationHistory.length

		// Call flush
		await task.flushPendingToolResultsToHistory()

		// History should not have changed since userMessageContent was empty
		expect(task.apiConversationHistory.length).toBe(initialHistoryLength)
	})

	it("should save user message when userMessageContent has pending tool results", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set up pending tool result in pendingToolResults
		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-123",
				toolName: "write_to_file",
				output: { type: "text", value: "File written successfully" },
			},
		]

		await task.flushPendingToolResultsToHistory()

		// Should have saved 1 tool message
		expect(task.apiConversationHistory.length).toBe(1)

		// Check tool message with tool result
		const toolMessage = task.apiConversationHistory[0] as any
		expect(toolMessage.role).toBe("tool")
		expect(Array.isArray(toolMessage.content)).toBe(true)
		expect((toolMessage.content as any[])[0].type).toBe("tool-result")
		expect((toolMessage.content as any[])[0].toolCallId).toBe("tool-123")
	})

	it("should clear pendingToolResults after flushing", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set up pending tool result
		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-456",
				toolName: "execute_command",
				output: { type: "text", value: "Command executed" },
			},
		]

		await task.flushPendingToolResultsToHistory()

		// pendingToolResults should be cleared
		expect(task.pendingToolResults.length).toBe(0)
	})

	it("should handle multiple tool results in a single flush", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set up multiple pending tool results
		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-1",
				toolName: "read_file",
				output: { type: "text", value: "First result" },
			},
			{
				type: "tool-result",
				toolCallId: "tool-2",
				toolName: "write_to_file",
				output: { type: "text", value: "Second result" },
			},
		]

		await task.flushPendingToolResultsToHistory()

		// Check tool message has both tool results
		const toolMessage = task.apiConversationHistory[0] as any
		expect(Array.isArray(toolMessage.content)).toBe(true)
		expect((toolMessage.content as any[]).length).toBe(2)
		expect((toolMessage.content as any[])[0].toolCallId).toBe("tool-1")
		expect((toolMessage.content as any[])[1].toolCallId).toBe("tool-2")
	})

	it("should add timestamp to saved messages", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		const beforeTs = Date.now()

		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-ts",
				toolName: "read_file",
				output: { type: "text", value: "Result" },
			},
		]

		await task.flushPendingToolResultsToHistory()

		const afterTs = Date.now()

		// Message should have timestamp
		expect((task.apiConversationHistory[0] as any).ts).toBeGreaterThanOrEqual(beforeTs)
		expect((task.apiConversationHistory[0] as any).ts).toBeLessThanOrEqual(afterTs)
	})

	it("should skip waiting for assistantMessageSavedToHistory when flag is already true", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set flag to true (assistant message already saved)
		task.assistantMessageSavedToHistory = true

		// Set up pending tool result
		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-skip-wait",
				toolName: "read_file",
				output: { type: "text", value: "Result when flag is true" },
			},
		]

		// Clear mock call history
		mockPWaitFor.mockClear()

		await task.flushPendingToolResultsToHistory()

		// Should not have called pWaitFor since flag was already true
		expect(mockPWaitFor).not.toHaveBeenCalled()

		// Should still save the message
		expect(task.apiConversationHistory.length).toBe(1)
		expect(((task.apiConversationHistory[0] as any).content as any[])[0].toolCallId).toBe("tool-skip-wait")
	})

	it("should wait for assistantMessageSavedToHistory when flag is false", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Flag is false by default - assistant message not yet saved
		expect(task.assistantMessageSavedToHistory).toBe(false)

		// Set up pending tool result
		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-wait",
				toolName: "read_file",
				output: { type: "text", value: "Result when flag is false" },
			},
		]

		// Clear mock call history
		mockPWaitFor.mockClear()

		await task.flushPendingToolResultsToHistory()

		// Should have called pWaitFor since flag was false
		expect(mockPWaitFor).toHaveBeenCalled()

		// Should still save the message (mock resolves immediately)
		expect(task.apiConversationHistory.length).toBe(1)
	})

	it("should not flush when task is aborted during wait", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Flag is false - will need to wait
		task.assistantMessageSavedToHistory = false

		// Set up pending tool result
		task.pendingToolResults = [
			{
				type: "tool-result",
				toolCallId: "tool-aborted",
				toolName: "read_file",
				output: { type: "text", value: "Should not be saved" },
			},
		]

		// Set abort flag - this will cause the condition in pWaitFor to return true
		// AND will cause early return after the wait
		task.abort = true

		await task.flushPendingToolResultsToHistory()

		// Should not have saved anything since task was aborted
		expect(task.apiConversationHistory.length).toBe(0)
	})
})
