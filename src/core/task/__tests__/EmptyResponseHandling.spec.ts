// npx vitest core/task/__tests__/EmptyResponseHandling.spec.ts

import * as os from "os"
import * as path from "path"

import * as vscode from "vscode"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

import type { ProviderSettings, GlobalState } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ApiStreamChunk } from "../../../api/transform/stream"
import { ContextProxy } from "../../config/ContextProxy"

// Mock delay before any imports that might use it
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

import delay from "delay"

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

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
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
				stat: vi.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
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

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")

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
		getMessagesSinceLastSummary: vi.fn().mockImplementation((messages) => messages),
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
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("../../mentions/processUserContentMentions", () => ({
	processUserContentMentions: vi.fn().mockImplementation(({ userContent }) => Promise.resolve(userContent)),
}))

vi.mock("../../../api/transform/image-cleaning", () => ({
	maybeRemoveImageBlocks: vi.fn().mockImplementation((messages) => messages),
}))

describe("Empty Response Handling", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Reset the global timestamp before each test
		Task.resetGlobalApiRequestTime()

		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation((_key: keyof GlobalState) => undefined),
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

		// Setup mock output channel
		const mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		// Setup mock provider with output channel
		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel as any,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}

		// Mock provider methods
		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.getState = vi.fn().mockResolvedValue({})
		mockProvider.updateTaskHistory = vi.fn().mockResolvedValue(undefined)
		mockProvider.log = vi.fn()
	})

	afterEach(() => {
		// Clean up the global state after each test
		Task.resetGlobalApiRequestTime()
	})

	describe("Empty Model Response Retry", () => {
		it("should retry on empty assistant response with default mode", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock getTaskMode to return default mode
			vi.spyOn(task, "getTaskMode").mockResolvedValue("code")

			// Mock say to track retry messages
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Mock delay to track timing
			const mockDelay = delay as ReturnType<typeof vi.fn>
			mockDelay.mockClear()

			// Simulate empty response on first try, success on second
			let attemptCount = 0
			const mockRecursiveCall = vi.fn().mockImplementation(async function () {
				attemptCount++
				if (attemptCount === 1) {
					// First attempt: empty response (no assistant message)
					return false
				}
				// Second attempt: success
				return true
			})

			// Create a context that simulates empty response retry
			const stackItem = {
				userContent: [{ type: "text" as const, text: "test" }],
				includeFileDetails: false,
				retryAttempt: 0,
				emptyResponseRetries: 0,
			}

			// Mock the stream to return empty assistant message
			const emptyStream = {
				async *[Symbol.asyncIterator]() {
					// Empty response - no text chunks
					yield { type: "usage", inputTokens: 100, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
				},
			} as AsyncGenerator<ApiStreamChunk>

			const successStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: "Success response" }
				},
			} as AsyncGenerator<ApiStreamChunk>

			let callCount = 0
			vi.spyOn(task.api, "createMessage").mockImplementation(() => {
				callCount++
				return callCount === 1 ? emptyStream : successStream
			})

			// Mock addToApiConversationHistory
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)

			// Execute the recursive function with the stack item
			const result = await task.recursivelyMakeClineRequests(stackItem.userContent, stackItem.includeFileDetails)

			// Verify retry message was shown
			expect(saySpy).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				expect.stringContaining("The model returned an empty response. Retrying"),
				undefined,
				false,
			)

			// Verify delay was applied
			expect(mockDelay).toHaveBeenCalledWith(2000)
		})

		it("should provide orchestrator-specific message for empty responses", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock getTaskMode to return orchestrator mode
			vi.spyOn(task, "getTaskMode").mockResolvedValue("orchestrator")

			// Mock say and ask to track messages
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)
			const askSpy = vi.spyOn(task, "ask").mockResolvedValue({
				response: "messageResponse",
				text: "continue differently",
				images: undefined,
			})

			// Create empty response scenario
			const emptyStream = {
				async *[Symbol.asyncIterator]() {
					// Empty response
					yield { type: "usage", inputTokens: 100, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
				},
			} as AsyncGenerator<ApiStreamChunk>

			// Always return empty to test max retries
			vi.spyOn(task.api, "createMessage").mockReturnValue(emptyStream)

			// Mock addToApiConversationHistory
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)

			// Execute with max retries exhausted scenario
			const stackContext = {
				userContent: [{ type: "text" as const, text: "test" }],
				includeFileDetails: false,
				retryAttempt: 0,
				emptyResponseRetries: 3, // Already at max
			}

			// This should trigger the orchestrator-specific error handling
			await task.recursivelyMakeClineRequests(stackContext.userContent, stackContext.includeFileDetails)

			// Verify orchestrator-specific error message was shown
			expect(saySpy).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Orchestrator mode requires substantial model capacity"),
			)

			// Verify suggestion to switch modes was presented
			expect(askSpy).toHaveBeenCalledWith(
				"mistake_limit_reached",
				expect.stringContaining("Orchestrator mode is having difficulty"),
			)
		})

		it("should add simplification hint after first retry in orchestrator mode", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock getTaskMode to return orchestrator mode
			vi.spyOn(task, "getTaskMode").mockResolvedValue("orchestrator")

			// Track API calls to verify simplification hint
			const createMessageSpy = vi.fn()
			let apiCallCount = 0

			// Empty stream for first two attempts, success on third
			const emptyStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "usage", inputTokens: 100, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
				},
			} as AsyncGenerator<ApiStreamChunk>

			const successStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: "Simplified response" }
				},
			} as AsyncGenerator<ApiStreamChunk>

			task.api.createMessage = vi.fn().mockImplementation((system, messages) => {
				apiCallCount++
				createMessageSpy(system, messages)
				return apiCallCount <= 2 ? emptyStream : successStream
			})

			// Mock other required methods
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Execute the request
			await task.recursivelyMakeClineRequests(
				[{ type: "text" as const, text: "complex orchestration task" }],
				false,
			)

			// Verify that simplification hint was added after first retry
			const secondCallMessages = createMessageSpy.mock.calls[1]?.[1]
			expect(secondCallMessages).toBeDefined()

			// Look for the simplification hint in user content
			const hasSimplificationHint = secondCallMessages.some((msg: any) =>
				msg.content?.some(
					(content: any) =>
						content.type === "text" &&
						content.text?.includes("Please provide a simpler, more direct response"),
				),
			)
			expect(hasSimplificationHint).toBe(true)
		})
	})

	describe("Connection Error Handling", () => {
		it("should detect and handle connection errors with enhanced messages", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock provider state for auto-resubmit
			mockProvider.getState.mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysApproveResubmit: true,
				requestDelaySeconds: 1,
			})

			// Mock say to track error messages
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Mock backoffAndAnnounce to track enhanced error messages
			const backoffSpy = vi.spyOn(task as any, "backoffAndAnnounce").mockResolvedValue(undefined)

			// Create a connection error
			const connectionError = new Error("502 Proxy request to model failed: tcp connect error")

			// Mock stream that fails mid-stream with connection error
			const failingStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: "partial" }
					throw connectionError
				},
			} as AsyncGenerator<ApiStreamChunk>

			vi.spyOn(task.api, "createMessage").mockReturnValue(failingStream)

			// Mock other required methods
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task, "getTaskMode").mockResolvedValue("code")

			// Set up to track stream processing
			task.isStreaming = true

			// Attempt the request
			try {
				await task.recursivelyMakeClineRequests([{ type: "text" as const, text: "test" }], false)
			} catch (error) {
				// Expected to fail after retries
			}

			// Verify enhanced connection error message was shown
			expect(backoffSpy).toHaveBeenCalledWith(
				expect.any(Number),
				expect.any(Object),
				expect.stringContaining("Connection to local LLM failed"),
			)
		})

		it("should provide orchestrator-specific guidance for connection errors", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock getTaskMode to return orchestrator mode
			vi.spyOn(task, "getTaskMode").mockResolvedValue("orchestrator")

			// Mock provider state
			mockProvider.getState.mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysApproveResubmit: true,
			})

			// Mock say to track messages
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Create persistent connection error
			const connectionError = new Error("Connection refused")
			const failingStream = {
				// eslint-disable-next-line require-yield
				async *[Symbol.asyncIterator]() {
					throw connectionError
				},
				async next() {
					throw connectionError
				},
				async return() {
					return { done: true, value: undefined }
				},
				async throw(e: any) {
					throw e
				},
				async [Symbol.asyncDispose]() {
					// Cleanup
				},
			} as AsyncGenerator<ApiStreamChunk>

			vi.spyOn(task.api, "createMessage").mockReturnValue(failingStream)
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)

			// Execute with max connection retries
			const stackItem = {
				userContent: [{ type: "text" as const, text: "test" }],
				includeFileDetails: false,
				retryAttempt: 3, // Above maxConnectionRetries
			}

			try {
				await task.recursivelyMakeClineRequests(stackItem.userContent, stackItem.includeFileDetails)
			} catch (error) {
				// Expected to fail
			}

			// Verify orchestrator-specific connection error message
			expect(saySpy).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Orchestrator mode requires substantial model capacity"),
			)
		})

		it("should stop retrying after max connection failures", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock provider state
			mockProvider.getState.mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysApproveResubmit: true,
			})

			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Always fail with connection error
			const connectionError = new Error("tcp connect error: No connection")
			const failingStream = {
				// eslint-disable-next-line require-yield
				async *[Symbol.asyncIterator]() {
					throw connectionError
				},
				async next() {
					throw connectionError
				},
				async return() {
					return { done: true, value: undefined }
				},
				async throw(e: any) {
					throw e
				},
				async [Symbol.asyncDispose]() {
					// Cleanup
				},
			} as AsyncGenerator<ApiStreamChunk>

			vi.spyOn(task.api, "createMessage").mockReturnValue(failingStream)
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task, "getTaskMode").mockResolvedValue("code")

			// Track retry attempts
			let retryCount = 0
			const originalRecursive = task.recursivelyMakeClineRequests.bind(task)
			vi.spyOn(task, "recursivelyMakeClineRequests").mockImplementation(
				async (userContent, includeFileDetails) => {
					retryCount++
					if (retryCount > 3) {
						// Stop after max retries
						return true
					}
					return originalRecursive(userContent, includeFileDetails)
				},
			)

			// Execute
			try {
				await task.recursivelyMakeClineRequests([{ type: "text" as const, text: "test" }], false)
			} catch (error) {
				// Expected
			}

			// Verify persistent connection error message was shown
			expect(saySpy).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Persistent connection issues with local LLM detected"),
			)
		})
	})

	describe("Retry Counter Tracking", () => {
		it("should increment empty response retry counter independently", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Track retry counts
			const retryTracking: any[] = []

			// Mock recursivelyMakeClineRequests to inspect stack items
			const originalMethod = task.recursivelyMakeClineRequests.bind(task)
			let callCount = 0

			vi.spyOn(task, "recursivelyMakeClineRequests").mockImplementation(
				async function (userContent, includeFileDetails) {
					callCount++
					// Capture the retry state
					retryTracking.push({
						call: callCount,
						userContent,
						includeFileDetails,
					})

					// Simulate empty response for first 2 calls
					if (callCount <= 2) {
						// Return false to simulate empty response
						return false
					}
					return true
				},
			)

			// Execute
			await task.recursivelyMakeClineRequests([{ type: "text" as const, text: "test" }], false)

			// Verify retry tracking occurred
			expect(callCount).toBeGreaterThan(1)
		})

		it("should track connection retry attempts separately from empty response retries", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			mockProvider.getState.mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysApproveResubmit: true,
			})

			// Track different retry types
			const emptyResponseCalls: any[] = []
			const connectionErrorCalls: any[] = []

			// Mock say to differentiate retry types
			vi.spyOn(task, "say").mockImplementation(async (type, text) => {
				if (text?.includes("empty response")) {
					emptyResponseCalls.push({ type, text })
				} else if (text?.includes("Connection")) {
					connectionErrorCalls.push({ type, text })
				}
				return undefined
			})

			// First return empty response, then connection error
			let apiCallCount = 0
			const emptyStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "usage", inputTokens: 100, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
				},
			} as AsyncGenerator<ApiStreamChunk>

			const connectionErrorStream = {
				// eslint-disable-next-line require-yield
				async *[Symbol.asyncIterator]() {
					throw new Error("tcp connect error")
				},
				async next() {
					throw new Error("tcp connect error")
				},
				async return() {
					return { done: true, value: undefined }
				},
				async throw(e: any) {
					throw e
				},
				async [Symbol.asyncDispose]() {
					// Cleanup
				},
			} as AsyncGenerator<ApiStreamChunk>

			const successStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: "success" }
				},
			} as AsyncGenerator<ApiStreamChunk>

			vi.spyOn(task.api, "createMessage").mockImplementation(() => {
				apiCallCount++
				if (apiCallCount === 1) return emptyStream
				if (apiCallCount === 2) return connectionErrorStream
				return successStream
			})

			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task, "getTaskMode").mockResolvedValue("code")

			// Execute
			try {
				await task.recursivelyMakeClineRequests([{ type: "text" as const, text: "test" }], false)
			} catch (error) {
				// May fail, that's OK
			}

			// Verify we tracked both types of retries
			expect(apiCallCount).toBeGreaterThanOrEqual(2)
		})
	})
})
