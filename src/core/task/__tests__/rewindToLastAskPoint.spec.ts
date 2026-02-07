// npx vitest run core/task/__tests__/rewindToLastAskPoint.spec.ts

import {
	initializeTelemetry,
	createMockExtensionContext,
	createMockProvider,
	createTask,
} from "./fixtures/rewind-test-setup"

// ---------------------------------------------------------------------------
// vi.mock() declarations — must live in the test file (vitest hoists them).
// ---------------------------------------------------------------------------

vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("uuid", async (importOriginal) => {
	const actual = await importOriginal<typeof import("uuid")>()
	return {
		...actual,
		v7: vi.fn(() => "00000000-0000-7000-8000-000000000000"),
	}
})

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	const mockFunctions = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockImplementation((filePath) => {
			if (filePath.includes("ui_messages.json")) {
				return Promise.resolve(JSON.stringify([]))
			}
			if (filePath.includes("api_conversation_history.json")) {
				return Promise.resolve(JSON.stringify([]))
			}
			return Promise.resolve("[]")
		}),
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

	return {
		TabInputTextDiff: vi.fn(),
		CodeActionKind: {
			QuickFix: { value: "quickfix" },
			RefactorRewrite: { value: "refactor.rewrite" },
		},
		window: {
			createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			visibleTextEditors: [],
			tabGroups: {
				all: [],
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

// ---------------------------------------------------------------------------

describe("rewindToLastAskPoint", () => {
	let mockProvider: any

	beforeEach(() => {
		initializeTelemetry()
		const ctx = createMockExtensionContext()
		mockProvider = createMockProvider(ctx)
	})

	it("should return false when no ask point exists", async () => {
		const task = createTask(mockProvider)

		// Empty clineMessages
		task.clineMessages = []

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(false)
	})

	it("should truncate clineMessages to last ask point", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "tool", text: "approve write_to_file" },
			{ ts: now - 3000, type: "say", say: "text", text: "streaming response..." },
			{ ts: now - 2000, type: "say", say: "api_req_started", text: "{}" },
		]

		task.apiConversationHistory = []

		const overwriteClineSpy = vi.spyOn(task as any, "overwriteClineMessages")
		const overwriteApiSpy = vi.spyOn(task as any, "overwriteApiConversationHistory")

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should truncate to include the ask at index 1
		expect(task.clineMessages).toHaveLength(2)
		expect(task.clineMessages[1].ask).toBe("tool")

		// Verify persistence was triggered with the correct truncated data
		expect(overwriteClineSpy).toHaveBeenCalledWith(task.clineMessages)
		expect(overwriteApiSpy).toHaveBeenCalledWith(task.apiConversationHistory)
	})

	it("should skip non-blocking asks (command_output)", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "followup", text: "what do you want?" },
			{ ts: now - 3000, type: "say", say: "user_feedback", text: "this response" },
			{ ts: now - 2000, type: "ask", ask: "command_output", text: "output data" },
		]

		task.apiConversationHistory = []

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should rewind to the "followup" ask, skipping command_output
		expect(task.clineMessages).toHaveLength(2)
		expect(task.clineMessages[1].ask).toBe("followup")
	})

	it("should skip resume_task and resume_completed_task asks", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "completion_result", text: "done" },
			{ ts: now - 3000, type: "ask", ask: "resume_completed_task", text: "" },
		]

		task.apiConversationHistory = []

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should rewind to the "completion_result" ask, skipping resume_completed_task
		expect(task.clineMessages).toHaveLength(2)
		expect(task.clineMessages[1].ask).toBe("completion_result")
	})

	it("should remove trailing assistant message with unanswered tool_use", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 3000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "tool", text: "approve write_to_file" },
		]

		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "do something" }],
				ts: now - 4000,
			},
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I'll edit the file" },
					{
						type: "tool_use",
						id: "tool-1",
						name: "write_to_file",
						input: { path: "test.ts", content: "hello" },
					},
				],
				ts: now - 3000,
			},
		] as any[]

		const overwriteClineSpy = vi.spyOn(task as any, "overwriteClineMessages")
		const overwriteApiSpy = vi.spyOn(task as any, "overwriteApiConversationHistory")

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should remove the assistant message with unanswered tool_use
		expect(task.apiConversationHistory).toHaveLength(1)
		expect(task.apiConversationHistory[0].role).toBe("user")

		// Verify persistence was triggered with the correct truncated data
		expect(overwriteClineSpy).toHaveBeenCalledWith(task.clineMessages)
		expect(overwriteApiSpy).toHaveBeenCalledWith(task.apiConversationHistory)
	})

	it("should keep assistant message with text-only content", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 3000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "followup", text: "what next?" },
		]

		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "do something" }],
				ts: now - 4000,
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "What would you like me to do?" }],
				ts: now - 3000,
			},
		] as any[]

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should keep the text-only assistant message
		expect(task.apiConversationHistory).toHaveLength(2)
		expect(task.apiConversationHistory[1].role).toBe("assistant")
	})

	it("should remove incomplete user message and its assistant message", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 3000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "tool", text: "approve next op" },
		]

		// Scenario: assistant made 2 tool calls, user only answered 1
		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "do something" }],
				ts: now - 5000,
			},
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-1",
						name: "read_file",
						input: { path: "test.ts" },
					},
					{
						type: "tool_use",
						id: "tool-2",
						name: "write_to_file",
						input: { path: "test.ts", content: "hello" },
					},
				],
				ts: now - 4000,
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-1",
						content: "file contents",
					},
					// tool-2 tool_result is missing
				],
				ts: now - 3000,
			},
		] as any[]

		const overwriteClineSpy = vi.spyOn(task as any, "overwriteClineMessages")
		const overwriteApiSpy = vi.spyOn(task as any, "overwriteApiConversationHistory")

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should remove both the incomplete user message and the assistant message
		expect(task.apiConversationHistory).toHaveLength(1)
		expect(task.apiConversationHistory[0].role).toBe("user")

		// Verify persistence was triggered with the correct truncated data
		expect(overwriteClineSpy).toHaveBeenCalledWith(task.clineMessages)
		expect(overwriteApiSpy).toHaveBeenCalledWith(task.apiConversationHistory)
	})

	it("should not remove user message when all tool_results are present", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 3000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "tool", text: "approve next op" },
		]

		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "do something" }],
				ts: now - 5000,
			},
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-1",
						name: "read_file",
						input: { path: "test.ts" },
					},
				],
				ts: now - 4000,
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-1",
						content: "file contents",
					},
				],
				ts: now - 3000,
			},
		] as any[]

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// All tool_results present - should keep everything
		expect(task.apiConversationHistory).toHaveLength(3)
	})

	it("should handle empty apiConversationHistory gracefully", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 3000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "followup", text: "question" },
		]

		task.apiConversationHistory = []

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// clineMessages should still be truncated
		expect(task.clineMessages).toHaveLength(2)
		// apiConversationHistory should remain empty
		expect(task.apiConversationHistory).toHaveLength(0)
	})

	it("should skip partial ask messages", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "tool", text: "approve this" },
			{ ts: now - 3000, type: "ask", ask: "command", text: "run this", partial: true },
		]

		task.apiConversationHistory = []

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(true)

		// Should skip the partial ask and rewind to the completed "tool" ask
		expect(task.clineMessages).toHaveLength(2)
		expect(task.clineMessages[1].ask).toBe("tool")
	})

	it("should return false when overwriteClineMessages throws an error", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "tool", text: "approve write_to_file" },
			{ ts: now - 3000, type: "say", say: "text", text: "streaming response..." },
		]

		task.apiConversationHistory = []

		// Make overwriteClineMessages throw to simulate a disk write failure
		const overwriteSpy = vi
			.spyOn(task as any, "overwriteClineMessages")
			.mockRejectedValue(new Error("disk write failed"))

		const result = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(false)

		overwriteSpy.mockRestore()
	})
})
