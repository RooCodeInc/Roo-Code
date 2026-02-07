// npx vitest run core/task/__tests__/rewind-integration.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

import type { ClineMessage } from "@roo-code/types"

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

describe("rewind-integration", () => {
	let mockProvider: any

	beforeEach(() => {
		initializeTelemetry()
		const ctx = createMockExtensionContext()
		mockProvider = createMockProvider(ctx)
	})

	it("abort → resume produces clean state", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		// Set up clineMessages with several asks and an in-progress tool
		task.clineMessages = [
			{ ts: now - 6000, type: "say", say: "text", text: "user task" },
			{ ts: now - 5000, type: "ask", ask: "followup", text: "what should I do?" },
			{ ts: now - 4000, type: "say", say: "user_feedback", text: "do it" },
			{ ts: now - 3000, type: "ask", ask: "tool", text: "approve write_to_file" },
			{ ts: now - 2000, type: "say", say: "text", text: "streaming partial response..." },
			{ ts: now - 1000, type: "say", say: "api_req_started", text: "{}" },
		]

		// Set up apiConversationHistory with an interrupted assistant message
		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "do something" }],
				ts: now - 7000,
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "What should I do?" }],
				ts: now - 6000,
			},
			{
				role: "user",
				content: [{ type: "text", text: "do it" }],
				ts: now - 5000,
			},
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I'll edit the file" },
					{
						type: "tool_use",
						id: "tool-write-1",
						name: "write_to_file",
						input: { path: "test.ts", content: "hello" },
					},
				],
				ts: now - 4000,
			},
		] as any[]

		// Abort the task (calls rewindToLastAskPoint internally)
		await (task as any).abortTask()

		// After abort + rewind, clineMessages should be truncated to the last valid ask
		// The last qualifying ask is "tool" at index 3
		expect(task.clineMessages).toHaveLength(4)
		expect(task.clineMessages[3].ask).toBe("tool")

		// apiConversationHistory: the trailing assistant message with unanswered tool_use
		// should be removed. Should have 3 messages: user, assistant(text-only), user
		expect(task.apiConversationHistory).toHaveLength(3)
		expect(task.apiConversationHistory[2].role).toBe("user")
	})

	it("completed task: getPendingAttemptCompletionToolUseId returns tool_use ID", () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		// Set up apiConversationHistory where the last assistant message has attempt_completion
		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "build a hello world app" }],
				ts: now - 5000,
			},
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I've built the app." },
					{
						type: "tool_use",
						id: "toolu_completion_123",
						name: "attempt_completion",
						input: { result: "Here is the completed app." },
					},
				],
				ts: now - 4000,
			},
		] as any[]

		const pendingId: string | undefined = (task as any).getPendingAttemptCompletionToolUseId()
		expect(pendingId).toBe("toolu_completion_123")
	})

	it("double rewind is idempotent", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "tool", text: "approve write_to_file" },
			{ ts: now - 3000, type: "say", say: "text", text: "streaming response..." },
			{ ts: now - 2000, type: "say", say: "api_req_started", text: "{}" },
		]

		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "do something" }],
				ts: now - 6000,
			},
			{
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-1",
						name: "write_to_file",
						input: { path: "test.ts", content: "hello" },
					},
				],
				ts: now - 5000,
			},
		] as any[]

		// First rewind
		const result1: boolean = await (task as any).rewindToLastAskPoint()
		expect(result1).toBe(true)

		const clineMessagesAfterFirst: ClineMessage[] = [...task.clineMessages]
		const apiHistoryAfterFirst: Anthropic.MessageParam[] = [...task.apiConversationHistory]

		// Second rewind
		const result2: boolean = await (task as any).rewindToLastAskPoint()
		expect(result2).toBe(true)

		// State should be identical after both rewinds
		expect(task.clineMessages).toEqual(clineMessagesAfterFirst)
		expect(task.apiConversationHistory).toEqual(apiHistoryAfterFirst)
	})

	it("rewind with no qualifying ask points returns false", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		// Only has command_output asks (non-qualifying) and partial asks
		task.clineMessages = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 4000, type: "ask", ask: "command_output", text: "some output" },
			{ ts: now - 3000, type: "ask", ask: "command_output", text: "more output" },
			{ ts: now - 2000, type: "ask", ask: "tool", text: "partial ask", partial: true },
		]

		task.apiConversationHistory = []

		const result: boolean = await (task as any).rewindToLastAskPoint()
		expect(result).toBe(false)
	})

	// -----------------------------------------------------------------------
	// Task C — completion → restart → resume scenarios
	// -----------------------------------------------------------------------

	it("completion → restart → resume with follow-up text routes as tool_result", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		// Simulate persisted state after an attempt_completion was presented.
		const savedClineMessages: ClineMessage[] = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "completion_result", text: "Here is the completed app." },
		]

		const savedApiHistory = [
			{
				role: "user" as const,
				content: [{ type: "text" as const, text: "build a hello world app" }],
				ts: now - 5000,
			},
			{
				role: "assistant" as const,
				content: [
					{ type: "text" as const, text: "I've built the app." },
					{
						type: "tool_use" as const,
						id: "toolu_completion_abc",
						name: "attempt_completion",
						input: { result: "Here is the completed app." },
					},
				],
				ts: now - 4000,
			},
		]

		// Mock the persistence/loading methods so resumeTaskFromHistory can run
		// without real disk I/O.
		vi.spyOn(task as any, "getSavedClineMessages").mockImplementation(async () =>
			savedClineMessages.map((m) => ({ ...m })),
		)
		vi.spyOn(task as any, "getSavedApiConversationHistory").mockResolvedValue(
			savedApiHistory.map((m) => ({ ...m, content: [...(m.content as any[])] })),
		)
		vi.spyOn(task as any, "overwriteClineMessages").mockImplementation(async (msgs: any) => {
			task.clineMessages = msgs
		})

		// Simulate user providing follow-up text via "New Task" / message response
		const askSpy = vi.spyOn(task as any, "ask").mockResolvedValue({
			response: "messageResponse",
			text: "looks good, thanks!",
			images: [],
		})
		vi.spyOn(task as any, "say").mockResolvedValue(undefined)
		const loopSpy = vi.spyOn(task as any, "initiateTaskLoop").mockResolvedValue(undefined)

		await (task as any).resumeTaskFromHistory()

		// Should present as resume_completed_task (not resume_task)
		expect(askSpy).toHaveBeenCalledWith("resume_completed_task")

		// The follow-up should be routed as a tool_result for the pending
		// attempt_completion tool_use — NOT as a bare text block.
		expect(loopSpy).toHaveBeenCalledTimes(1)
		const sentContent = loopSpy.mock.calls[0][0] as any[]
		expect(sentContent).toHaveLength(1)
		expect(sentContent[0].type).toBe("tool_result")
		expect(sentContent[0].tool_use_id).toBe("toolu_completion_abc")
		expect(sentContent[0].content).toContain("looks good, thanks!")
	})

	it("completion → restart → resume without follow-up text injects completed status", async () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		const savedClineMessages: ClineMessage[] = [
			{ ts: now - 5000, type: "say", say: "text", text: "user task" },
			{ ts: now - 2000, type: "ask", ask: "completion_result", text: "Done." },
		]

		const savedApiHistory = [
			{
				role: "user" as const,
				content: [{ type: "text" as const, text: "build it" }],
				ts: now - 5000,
			},
			{
				role: "assistant" as const,
				content: [
					{ type: "text" as const, text: "Done." },
					{
						type: "tool_use" as const,
						id: "toolu_completion_xyz",
						name: "attempt_completion",
						input: { result: "Done." },
					},
				],
				ts: now - 4000,
			},
		]

		vi.spyOn(task as any, "getSavedClineMessages").mockImplementation(async () =>
			savedClineMessages.map((m) => ({ ...m })),
		)
		vi.spyOn(task as any, "getSavedApiConversationHistory").mockResolvedValue(
			savedApiHistory.map((m) => ({ ...m, content: [...(m.content as any[])] })),
		)
		vi.spyOn(task as any, "overwriteClineMessages").mockImplementation(async (msgs: any) => {
			task.clineMessages = msgs
		})

		// Simulate user clicking "continue" without providing any text
		vi.spyOn(task as any, "ask").mockResolvedValue({
			response: "yesButtonClicked",
			text: undefined,
			images: undefined,
		})
		vi.spyOn(task as any, "say").mockResolvedValue(undefined)
		const loopSpy = vi.spyOn(task as any, "initiateTaskLoop").mockResolvedValue(undefined)

		await (task as any).resumeTaskFromHistory()

		// Should inject a {"status":"completed"} tool_result as fallback
		expect(loopSpy).toHaveBeenCalledTimes(1)
		const sentContent = loopSpy.mock.calls[0][0] as any[]
		expect(sentContent).toHaveLength(1)
		expect(sentContent[0].type).toBe("tool_result")
		expect(sentContent[0].tool_use_id).toBe("toolu_completion_xyz")

		const parsedContent = JSON.parse(sentContent[0].content)
		expect(parsedContent.status).toBe("completed")
	})

	it("attempt_completion alongside another tool_use in same assistant message", () => {
		const task = createTask(mockProvider)
		const now = Date.now()

		// Edge case: assistant message contains both a read_file tool_use and
		// an attempt_completion tool_use. getPendingAttemptCompletionToolUseId
		// should still detect the attempt_completion.
		task.apiConversationHistory = [
			{
				role: "user",
				content: [{ type: "text", text: "build and verify the app" }],
				ts: now - 5000,
			},
			{
				role: "assistant",
				content: [
					{ type: "text", text: "I'll verify and complete." },
					{
						type: "tool_use",
						id: "toolu_read_999",
						name: "read_file",
						input: { path: "package.json" },
					},
					{
						type: "tool_use",
						id: "toolu_completion_888",
						name: "attempt_completion",
						input: { result: "App is ready." },
					},
				],
				ts: now - 4000,
			},
		] as any[]

		const pendingId: string | undefined = (task as any).getPendingAttemptCompletionToolUseId()
		expect(pendingId).toBe("toolu_completion_888")
	})
})
