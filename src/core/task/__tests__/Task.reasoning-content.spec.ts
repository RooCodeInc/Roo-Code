import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import type { ApiMessage } from "../../task-persistence/apiMessages"

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

// Mock task persistence
vi.mock("../../task-persistence/apiMessages", async () => {
	const actual = await vi.importActual("../../task-persistence/apiMessages")
	return {
		...actual,
		saveApiMessages: vi.fn().mockResolvedValue(undefined),
		readApiMessages: vi.fn().mockResolvedValue([]),
	}
})

describe("Task reasoning_content persistence (interleaved thinking mode)", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let Task: any

	beforeAll(async () => {
		// Import Task after mocks are set up
		const taskModule = await import("../Task")
		Task = taskModule.Task
	})

	beforeEach(() => {
		// Mock provider with necessary methods
		mockProvider = {
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
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
			apiProvider: "openai",
			apiKey: "test-key",
			openAiModelId: "deepseek-reasoner", // Interleaved thinking model
		} as ProviderSettings
	})

	it("should save reasoning_content as top-level field for interleaved thinking models", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		// Avoid disk writes in this test
		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		// Mock API handler with interleaved thinking capability
		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const reasoningContent = "Let me think about this step by step. First, I need to analyze the problem..."
		const assistantContent = "Here is my response to your question."

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: assistantContent }],
			},
			reasoningContent,
		)

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as ApiMessage

		expect(stored.role).toBe("assistant")
		// For interleaved thinking models, reasoning_content should be a top-level field
		expect((stored as any).reasoning_content).toBe(reasoningContent)
		// Content should NOT contain reasoning blocks
		expect(Array.isArray(stored.content)).toBe(true)
		expect(stored.content).toHaveLength(1)
		expect(stored.content[0]).toMatchObject({
			type: "text",
			text: assistantContent,
		})
	})

	it("should save reasoning_content with both content and tool calls", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const reasoningContent = "I need to call a tool to get the current date."
		const assistantContent = [
			{ type: "text", text: "Let me check the date." },
			{
				type: "tool_use",
				id: "call_123",
				name: "get_date",
				input: {},
			},
		]

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: assistantContent,
			},
			reasoningContent,
		)

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as ApiMessage

		expect(stored.role).toBe("assistant")
		expect((stored as any).reasoning_content).toBe(reasoningContent)
		expect(Array.isArray(stored.content)).toBe(true)
		expect(stored.content).toHaveLength(2)
		expect(stored.content[0]).toMatchObject({ type: "text", text: "Let me check the date." })
		expect(stored.content[1]).toMatchObject({
			type: "tool_use",
			id: "call_123",
			name: "get_date",
		})
	})

	it("should save message with only reasoning_content (no content)", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const reasoningContent = "I'm still thinking about this problem..."

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [],
			},
			reasoningContent,
		)

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as ApiMessage

		expect(stored.role).toBe("assistant")
		expect((stored as any).reasoning_content).toBe(reasoningContent)
		expect(Array.isArray(stored.content)).toBe(true)
		expect(stored.content).toHaveLength(0)
	})

	it("should NOT save reasoning_content for non-interleaved thinking models", async () => {
		const nonInterleavedThinkingConfig = {
			...mockApiConfiguration,
			openAiModelId: "gpt-4",
		} as ProviderSettings

		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: nonInterleavedThinkingConfig,
			task: "Test task",
			startTask: false,
		})

		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "gpt-4",
				info: {
					contextWindow: 8192,
					supportsPromptCache: true,
					supportsInterleavedThinking: false,
				},
			}),
		} as any

		const reasoningContent = "Let me think about this..."
		const assistantContent = "Here is my response."

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: assistantContent }],
			},
			reasoningContent,
		)

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as ApiMessage

		expect(stored.role).toBe("assistant")
		// For non-interleaved thinking models, reasoning should be in content blocks, not as reasoning_content
		expect((stored as any).reasoning_content).toBeUndefined()
		expect(Array.isArray(stored.content)).toBe(true)
		// Should have reasoning block + text block
		expect(stored.content.length).toBeGreaterThanOrEqual(1)
		// First block should be reasoning type
		expect(stored.content[0]).toMatchObject({
			type: "reasoning",
			text: reasoningContent,
		})
	})

	it("should handle empty reasoning_content gracefully", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const assistantContent = "Here is my response."

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: assistantContent }],
			},
			undefined, // No reasoning
		)

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as ApiMessage

		expect(stored.role).toBe("assistant")
		expect((stored as any).reasoning_content).toBeUndefined()
		expect(Array.isArray(stored.content)).toBe(true)
		expect(stored.content).toHaveLength(1)
		expect(stored.content[0]).toMatchObject({
			type: "text",
			text: assistantContent,
		})
	})

	it("should preserve reasoning_content when message is restored from storage", async () => {
		const { readApiMessages, saveApiMessages } = await import("../../task-persistence/apiMessages")

		// Create a task and save a message with reasoning_content
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const reasoningContent = "This is the reasoning content that should be preserved."
		const assistantContent = "Here is the final answer."

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: assistantContent }],
			},
			reasoningContent,
		)

		// Verify it was saved
		expect(task.apiConversationHistory).toHaveLength(1)
		const saved = task.apiConversationHistory[0] as ApiMessage
		expect((saved as any).reasoning_content).toBe(reasoningContent)

		// Simulate restoration: read the saved messages
		const savedMessages = task.apiConversationHistory
		vi.mocked(readApiMessages).mockResolvedValue(savedMessages as ApiMessage[])

		// Create a new task instance and restore
		const restoredTask = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		const restoredHistory = await (restoredTask as any).getSavedApiConversationHistory()

		expect(restoredHistory).toHaveLength(1)
		const restored = restoredHistory[0] as ApiMessage

		// Verify reasoning_content is preserved
		expect((restored as any).reasoning_content).toBe(reasoningContent)
		expect(restored.role).toBe("assistant")
		expect(Array.isArray(restored.content)).toBe(true)
		expect(restored.content[0]).toMatchObject({
			type: "text",
			text: assistantContent,
		})
	})

	it("should work with reasoning_details (should not save reasoning_content if reasoning_details exists)", async () => {
		const task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		;(task as any).saveApiConversationHistory = vi.fn().mockResolvedValue(undefined)

		// Mock API handler with reasoning_details (e.g., Gemini 3)
		task.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
			getReasoningDetails: vi
				.fn()
				.mockReturnValue([{ type: "reasoning", text: "Reasoning from reasoning_details" }]),
		} as any

		const reasoningContent = "This should be ignored because reasoning_details exists"

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
			},
			reasoningContent,
		)

		expect(task.apiConversationHistory).toHaveLength(1)
		const stored = task.apiConversationHistory[0] as ApiMessage

		// Should have reasoning_details, not reasoning_content
		expect(stored.reasoning_details).toBeDefined()
		expect((stored as any).reasoning_content).toBeUndefined()
	})
})
