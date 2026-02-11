import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"

// All vi.mock() calls are hoisted to the top of the file by Vitest
// and are applied before any imports are resolved

// Mock vscode module before importing Task
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		openTextDocument: vi.fn(),
		applyEdit: vi.fn(),
	},
	RelativePattern: vi.fn((base, pattern) => ({ base, pattern })),
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			dispose: vi.fn(),
		})),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		showTextDocument: vi.fn(),
		activeTextEditor: undefined,
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
		parse: vi.fn((str) => ({ toString: () => str })),
	},
	Range: vi.fn(),
	Position: vi.fn(),
	WorkspaceEdit: vi.fn(() => ({
		replace: vi.fn(),
		insert: vi.fn(),
		delete: vi.fn(),
	})),
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
}))

// Mock other dependencies
vi.mock("../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue(null),
	},
}))

vi.mock("../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureLlmCompletion: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

// Mock @roo-code/cloud to prevent socket.io-client initialization issues
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		isEnabled: () => false,
	},
	BridgeOrchestrator: {
		subscribeToTask: vi.fn(),
	},
}))

// Mock delay to prevent actual delays
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

// Mock p-wait-for to prevent hanging on async conditions
vi.mock("p-wait-for", () => ({
	default: vi.fn().mockResolvedValue(undefined),
}))

// Mock execa
vi.mock("execa", () => ({
	execa: vi.fn(),
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("[]"),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

// Mock mentions
vi.mock("../../mentions", () => ({
	parseMentions: vi.fn().mockImplementation((text) => Promise.resolve({ text, mode: undefined, contentBlocks: [] })),
	openMention: vi.fn(),
	getLatestTerminalOutput: vi.fn(),
}))

// Mock extract-text
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

// Mock getEnvironmentDetails
vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

// Mock RooIgnoreController
vi.mock("../../ignore/RooIgnoreController")

// Mock condense
vi.mock("../../condense", () => ({
	summarizeConversation: vi.fn().mockResolvedValue({
		messages: [],
		summary: "summary",
		cost: 0,
		newContextTokens: 1,
	}),
}))

// Mock storage utilities
vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

// Mock fs utilities
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(false),
}))

// Import Task AFTER all vi.mock() calls - Vitest hoists mocks so this works
import { Task } from "../Task"

describe("Task reasoning preservation", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings

	beforeEach(() => {
		// Mock provider with necessary methods
		mockProvider = {
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postStateToWebviewWithoutTaskHistory: vi.fn().mockResolvedValue(undefined),
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				experiments: {},
			}),
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
				extensionPath: "/test/extension",
			} as any,
			log: vi.fn(),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
		}

		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiKey: "test-key",
		} as ProviderSettings
	})

	it("should store native AI SDK format messages directly when providerOptions present", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		// Avoid disk writes in this test
		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getResponseId: vi.fn().mockReturnValue("resp_123"),
		} as any

		task.apiConversationHistory = []

		// Simulate a native AI SDK response message (has providerOptions on reasoning part)
		await (task as any).addToApiConversationHistory({
			role: "assistant",
			content: [
				{
					type: "reasoning",
					text: "Let me think about this...",
					providerOptions: {
						anthropic: { signature: "sig_abc123" },
					},
				},
				{ type: "text", text: "Here is my response." },
			],
		})

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as any

		expect(stored.role).toBe("assistant")
		expect(stored.id).toBe("resp_123")
		// Content preserved exactly as-is (no manual block injection)
		expect(stored.content).toEqual([
			{
				type: "reasoning",
				text: "Let me think about this...",
				providerOptions: {
					anthropic: { signature: "sig_abc123" },
				},
			},
			{ type: "text", text: "Here is my response." },
		])
	})

	it("should store messages without providerOptions via fallback path", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		// Avoid disk writes in this test
		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getResponseId: vi.fn().mockReturnValue(undefined),
			getEncryptedContent: vi.fn().mockReturnValue(undefined),
		} as any

		task.apiConversationHistory = []

		// Non-AI-SDK message (no providerOptions on content parts)
		await (task as any).addToApiConversationHistory({
			role: "assistant",
			content: [{ type: "text", text: "Here is my response." }],
		})

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as any

		expect(stored.role).toBe("assistant")
		expect(stored.content).toEqual([{ type: "text", text: "Here is my response." }])
	})

	it("should handle empty reasoning message gracefully when preserveReasoning is true", async () => {
		// Create a task instance
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		// Mock the API to return a model with preserveReasoning enabled
		const mockModelInfo: ModelInfo = {
			contextWindow: 16000,
			supportsPromptCache: true,
			preserveReasoning: true,
		}

		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "test-model",
				info: mockModelInfo,
			}),
		} as any

		// Mock the API conversation history
		task.apiConversationHistory = []

		const assistantMessage = "Here is my response."

		await (task as any).addToApiConversationHistory({
			role: "assistant",
			content: [{ type: "text", text: assistantMessage }],
		})

		// Verify no reasoning blocks were added when no reasoning is present
		expect((task.apiConversationHistory[0] as any).content).toEqual([
			{ type: "text", text: "Here is my response." },
		])
	})

	it("should embed encrypted reasoning as first assistant content block", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		// Avoid disk writes in this test
		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		// Mock API handler to provide encrypted reasoning data and response id
		task.api = {
			getEncryptedContent: vi.fn().mockReturnValue({
				encrypted_content: "encrypted_payload",
				id: "rs_test",
			}),
			getResponseId: vi.fn().mockReturnValue("resp_test"),
		} as any

		await (task as any).addToApiConversationHistory({
			role: "assistant",
			content: [{ type: "text", text: "Here is my response." }],
		})

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as any

		expect(stored.role).toBe("assistant")
		expect(Array.isArray(stored.content)).toBe(true)
		expect(stored.id).toBe("resp_test")

		const [reasoningBlock, textBlock] = stored.content

		expect(reasoningBlock).toMatchObject({
			type: "reasoning",
			encrypted_content: "encrypted_payload",
			id: "rs_test",
		})

		expect(textBlock).toMatchObject({
			type: "text",
			text: "Here is my response.",
		})
	})

	it("should store native format with redacted thinking in providerOptions", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		// Avoid disk writes in this test
		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getResponseId: vi.fn().mockReturnValue("resp_456"),
		} as any

		task.apiConversationHistory = []

		// Simulate native format with redacted thinking (as AI SDK provides it)
		await (task as any).addToApiConversationHistory({
			role: "assistant",
			content: [
				{
					type: "reasoning",
					text: "Visible reasoning...",
					providerOptions: {
						anthropic: { signature: "sig_visible" },
					},
				},
				{
					type: "reasoning",
					text: "",
					providerOptions: {
						anthropic: { redactedData: "redacted_payload_abc" },
					},
				},
				{ type: "text", text: "My answer." },
			],
		})

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as any

		// All content preserved as-is including redacted reasoning
		expect(stored.content).toHaveLength(3)
		expect(stored.content[0].providerOptions.anthropic.signature).toBe("sig_visible")
		expect(stored.content[1].providerOptions.anthropic.redactedData).toBe("redacted_payload_abc")
	})
})
