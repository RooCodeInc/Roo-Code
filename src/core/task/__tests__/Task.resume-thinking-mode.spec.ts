import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import type { ApiMessage } from "../../task-persistence/apiMessages"
import * as apiMessages from "../../task-persistence/apiMessages"

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

describe("Task resumption with interleaved thinking mode", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let Task: any
	let savedMessages: ApiMessage[] = []

	beforeAll(async () => {
		// Import Task after mocks are set up
		const taskModule = await import("../Task")
		Task = taskModule.Task

		// Mock saveApiMessages to capture saved messages
		vi.spyOn(apiMessages, "saveApiMessages").mockImplementation(async ({ messages }) => {
			savedMessages = [...messages]
		})

		// Mock readApiMessages to return saved messages
		vi.spyOn(apiMessages, "readApiMessages").mockImplementation(async () => {
			return [...savedMessages]
		})
	})

	beforeEach(() => {
		// Reset saved messages
		savedMessages = []

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
			openAiModelId: "deepseek-reasoner",
		} as ProviderSettings
	})

	it("should save and restore reasoning_content during task save/restore cycle", async () => {
		// Create initial task
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

		// Save a message with reasoning_content
		const reasoningContent = "I need to analyze this problem carefully..."
		const assistantContent = "Here is my answer."

		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: assistantContent }],
			},
			reasoningContent,
		)

		// Verify it was saved
		expect(savedMessages).toHaveLength(1)
		const saved = savedMessages[0] as ApiMessage
		expect((saved as any).reasoning_content).toBe(reasoningContent)

		// Simulate task restoration
		const restoredTask = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		restoredTask.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		// Restore conversation history
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

	it("should preserve reasoning_content during tool call sequences across save/restore", async () => {
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

		// Simulate tool call sequence: first call with reasoning_content
		const reasoning1 = "I need to call get_date to get the current date."
		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "call_1",
						name: "get_date",
						input: {},
					},
				],
			},
			reasoning1,
		)

		// Simulate tool result
		await (task as any).addToApiConversationHistory({
			role: "user",
			content: [
				{
					type: "tool_result",
					tool_use_id: "call_1",
					content: "2025-12-01",
				},
			],
		})

		// Simulate second tool call with reasoning_content (continuation)
		const reasoning2 = "Now I have the date, I can call get_weather."
		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "call_2",
						name: "get_weather",
						input: { location: "Hangzhou", date: "2025-12-02" },
					},
				],
			},
			reasoning2,
		)

		// Verify all messages were saved
		expect(savedMessages).toHaveLength(3)

		// First assistant message should have reasoning_content
		const msg1 = savedMessages[0] as ApiMessage
		expect(msg1.role).toBe("assistant")
		expect((msg1 as any).reasoning_content).toBe(reasoning1)

		// Second assistant message should have reasoning_content
		const msg3 = savedMessages[2] as ApiMessage
		expect(msg3.role).toBe("assistant")
		expect((msg3 as any).reasoning_content).toBe(reasoning2)

		// Restore and verify
		const restoredTask = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		restoredTask.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const restoredHistory = await (restoredTask as any).getSavedApiConversationHistory()

		expect(restoredHistory).toHaveLength(3)
		expect((restoredHistory[0] as any).reasoning_content).toBe(reasoning1)
		expect((restoredHistory[2] as any).reasoning_content).toBe(reasoning2)
	})

	it("should handle multi-turn conversations with reasoning_content clearing", async () => {
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

		// Turn 1: User message
		await (task as any).addToApiConversationHistory({
			role: "user",
			content: "What is 2+2?",
		})

		// Turn 1: Assistant response with reasoning_content
		const reasoning1 = "I need to add 2 and 2 together."
		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: "The answer is 4." }],
			},
			reasoning1,
		)

		// Turn 2: New user message (reasoning_content from turn 1 should be cleared when sending to API)
		// But it should still be in storage for this test
		await (task as any).addToApiConversationHistory({
			role: "user",
			content: "What about 3+3?",
		})

		// Turn 2: Assistant response with new reasoning_content
		const reasoning2 = "I need to add 3 and 3 together."
		await (task as any).addToApiConversationHistory(
			{
				role: "assistant",
				content: [{ type: "text", text: "The answer is 6." }],
			},
			reasoning2,
		)

		// Verify all messages were saved with reasoning_content
		expect(savedMessages).toHaveLength(4)
		const turn1Assistant = savedMessages[1] as ApiMessage
		const turn2Assistant = savedMessages[3] as ApiMessage

		expect((turn1Assistant as any).reasoning_content).toBe(reasoning1)
		expect((turn2Assistant as any).reasoning_content).toBe(reasoning2)

		// Restore and verify both reasoning_content values are preserved
		const restoredTask = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "Test task",
			startTask: false,
		})

		restoredTask.api = {
			getModel: vi.fn().mockReturnValue({
				id: "deepseek-reasoner",
				info: {
					contextWindow: 65536,
					supportsPromptCache: false,
					supportsInterleavedThinking: true,
				},
			}),
		} as any

		const restoredHistory = await (restoredTask as any).getSavedApiConversationHistory()

		expect(restoredHistory).toHaveLength(4)
		expect((restoredHistory[1] as any).reasoning_content).toBe(reasoning1)
		expect((restoredHistory[3] as any).reasoning_content).toBe(reasoning2)

		// Note: The clearing logic will clear reasoning_content when
		// sending to API for new turns, but it should remain in storage
	})
})
