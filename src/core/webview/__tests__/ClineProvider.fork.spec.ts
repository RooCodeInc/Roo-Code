// npx vitest core/webview/__tests__/ClineProvider.fork.spec.ts

import * as vscode from "vscode"
import { ClineMessage } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { ContextProxy } from "../../config/ContextProxy"
import { Task, TaskOptions } from "../../task/Task"
import { ClineProvider } from "../ClineProvider"
import * as fs from "fs/promises"
import * as path from "path"

// Mock setup
vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
}))

vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
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
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
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
}))

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options, taskId) => ({
		api: undefined,
		abortTask: vi.fn(),
		handleWebviewAskResponse: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
		overwriteClineMessages: vi.fn(),
		overwriteApiConversationHistory: vi.fn(),
		getTaskNumber: vi.fn().mockReturnValue(0),
		setTaskNumber: vi.fn(),
		setParentTask: vi.fn(),
		setRootTask: vi.fn(),
		taskId: taskId || "test-task-id",
		emit: vi.fn(),
	})),
}))

vi.mock("../../../shared/modes", () => ({
	modes: [
		{
			slug: "code",
			name: "Code Mode",
			roleDefinition: "You are a code assistant",
			groups: ["read", "edit", "browser"],
		},
	],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	defaultModeSlug: "code",
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			initializeFilePaths: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

vi.mock("../../prompts/sections/custom-instructions", () => ({
	addCustomInstructions: vi.fn().mockResolvedValue("Combined instructions"),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
			info: { supportsComputerUse: false },
		}),
	}),
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
	codeMode: "code",
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

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(true),
		get instance() {
			return {
				isAuthenticated: vi.fn().mockReturnValue(false),
			}
		},
	},
	BridgeOrchestrator: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn().mockReturnValue(true),
		createInstance: vi.fn(),
		get instance() {
			return {
				track: vi.fn(),
				setProvider: vi.fn(),
			}
		},
	},
}))

vi.mock("../../../shared/experiments", () => ({
	experimentDefault: {},
}))

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolResultSchema: {},
	ListResourcesResultSchema: {},
	ListResourceTemplatesResultSchema: {},
	ListToolsResultSchema: {},
	ReadResourceResultSchema: {},
	ErrorCode: {
		InvalidRequest: "InvalidRequest",
		MethodNotFound: "MethodNotFound",
		InternalError: "InternalError",
	},
	McpError: class McpError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
			this.name = "McpError"
		}
	},
}))

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		listTools: vi.fn().mockResolvedValue({ tools: [] }),
		callTool: vi.fn().mockResolvedValue({ content: [] }),
	})),
}))

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockImplementation(async (_filePath: string) => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const lines = content.split("\n")
		return lines.map((line, index) => `${index + 1} | ${line}`).join("\n")
	}),
}))

vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("p-wait-for", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("delay", () => {
	const delayFn = (_ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

vi.mock("axios", () => ({
	default: {
		get: vi.fn().mockResolvedValue({ data: { data: [] } }),
		post: vi.fn(),
	},
	get: vi.fn().mockResolvedValue({ data: { data: [] } }),
	post: vi.fn(),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		testConnection: vi.fn().mockImplementation(async (url) => {
			if (url === "http://localhost:9222") {
				return {
					success: true,
					message: "Successfully connected to Chrome",
					endpoint: "ws://localhost:9222/devtools/browser/123",
				}
			} else {
				return {
					success: false,
					message: "Failed to connect to Chrome",
					endpoint: undefined,
				}
			}
		}),
	})),
}))

vi.mock("../../../services/browser/browserDiscovery", () => ({
	discoverChromeHostUrl: vi.fn().mockResolvedValue("http://localhost:9222"),
	tryChromeHostUrl: vi.fn().mockImplementation(async (url) => {
		return url === "http://localhost:9222"
	}),
	testBrowserConnection: vi.fn(),
}))

describe("ClineProvider - Fork Task From Message", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any
	let defaultTaskOptions: TaskOptions

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		const globalState: Record<string, string | undefined> = {
			mode: "code",
			currentApiConfigName: "current-config",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (globalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
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

		mockPostMessage = vi.fn()

		mockWebviewView = {
			webview: {
				postMessage: mockPostMessage,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
				cspSource: "vscode-webview://test-csp-source",
			},
			visible: true,
			onDidDispose: vi.fn().mockImplementation((callback) => {
				callback()
				return { dispose: vi.fn() }
			}),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		defaultTaskOptions = {
			provider,
			apiConfiguration: {
				apiProvider: "openrouter",
			},
		}

		// Mock getMcpHub method
		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})
	})

	describe("forkTaskFromMessage", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("successfully forks a task from a specific message", async () => {
			// Setup mock messages
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
				{ ts: 2000, type: "say", say: "text", text: "AI response 1" },
				{ ts: 3000, type: "say", say: "user_feedback", text: "Second message" }, // Fork from here
				{ ts: 4000, type: "say", say: "text", text: "AI response 2" },
				{ ts: 5000, type: "say", say: "user_feedback", text: "Third message" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000, role: "user", content: "First message" },
				{ ts: 2000, role: "assistant", content: "AI response 1" },
				{ ts: 3000, role: "user", content: "Second message" },
				{ ts: 4000, role: "assistant", content: "AI response 2" },
				{ ts: 5000, role: "user", content: "Third message" },
			] as any[]

			// Setup Task instance
			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			// Mock createTaskWithHistoryItem
			const createTaskSpy = vi
				.spyOn(provider, "createTaskWithHistoryItem")
				.mockResolvedValue(new Task(defaultTaskOptions) as any)

			// Get the message handler
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Trigger fork from message at timestamp 3000
			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 3000,
			})

			// Verify createTaskWithHistoryItem was called with correct forked messages
			expect(createTaskSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					task: "Forked conversation",
					ts: expect.any(Number),
					mode: "code",
					tokensIn: 0,
					tokensOut: 0,
					totalCost: 0,
				}),
			)

			// Verify the forked task directory was created
			expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("/test/storage/path/tasks/"), {
				recursive: true,
			})

			// Verify the forked messages were saved
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("task.json"),
				expect.stringContaining(
					JSON.stringify({
						id: expect.any(String),
						ts: expect.any(Number),
						task: "Forked conversation",
						mode: "code",
						tokensIn: 0,
						tokensOut: 0,
						totalCost: 0,
					}),
				),
				"utf8",
			)

			// Verify only messages up to and including timestamp 3000 were included
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("api_conversation_history.json"),
				expect.stringContaining(JSON.stringify([mockApiHistory[0], mockApiHistory[1], mockApiHistory[2]])),
				"utf8",
			)

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("cline_messages.json"),
				expect.stringContaining(JSON.stringify([mockMessages[0], mockMessages[1], mockMessages[2]])),
				"utf8",
			)
		})

		test("handles fork from the first message", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000, role: "user", content: "First message" },
				{ ts: 2000, role: "assistant", content: "AI response" },
			] as any[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			const createTaskSpy = vi
				.spyOn(provider, "createTaskWithHistoryItem")
				.mockResolvedValue(new Task(defaultTaskOptions) as any)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Fork from the first message
			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 1000,
			})

			// Should include only the first message
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("cline_messages.json"),
				expect.stringContaining(JSON.stringify([mockMessages[0]])),
				"utf8",
			)

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("api_conversation_history.json"),
				expect.stringContaining(JSON.stringify([mockApiHistory[0]])),
				"utf8",
			)
		})

		test("handles fork from the last message", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
				{ ts: 3000, type: "say", say: "user_feedback", text: "Last message" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000, role: "user", content: "First message" },
				{ ts: 2000, role: "assistant", content: "AI response" },
				{ ts: 3000, role: "user", content: "Last message" },
			] as any[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			const createTaskSpy = vi
				.spyOn(provider, "createTaskWithHistoryItem")
				.mockResolvedValue(new Task(defaultTaskOptions) as any)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Fork from the last message
			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 3000,
			})

			// Should include all messages
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("cline_messages.json"),
				expect.stringContaining(JSON.stringify(mockMessages)),
				"utf8",
			)

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("api_conversation_history.json"),
				expect.stringContaining(JSON.stringify(mockApiHistory)),
				"utf8",
			)
		})

		test("handles fork when no current task exists", async () => {
			// Clear the task stack
			;(provider as any).clineStack = []

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Try to fork when no task exists
			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 1000,
			})

			// Should not create any task
			expect(fs.mkdir).not.toHaveBeenCalled()
			expect(fs.writeFile).not.toHaveBeenCalled()
		})

		test("handles fork with non-existent timestamp", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000, role: "user", content: "First message" },
				{ ts: 2000, role: "assistant", content: "AI response" },
			] as any[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Try to fork from a non-existent timestamp
			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 9999,
			})

			// Should not create any task since message doesn't exist
			expect(fs.mkdir).not.toHaveBeenCalled()
			expect(fs.writeFile).not.toHaveBeenCalled()
		})

		test("handles fork with messages containing images", async () => {
			const mockMessages = [
				{
					ts: 1000,
					type: "say",
					say: "user_feedback",
					text: "Message with image",
					images: ["data:image/png;base64,abc123"],
				},
				{ ts: 2000, type: "say", say: "text", text: "AI response" },
			] as ClineMessage[]

			const mockApiHistory = [
				{ ts: 1000, role: "user", content: "Message with image" },
				{ ts: 2000, role: "assistant", content: "AI response" },
			] as any[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			const createTaskSpy = vi
				.spyOn(provider, "createTaskWithHistoryItem")
				.mockResolvedValue(new Task(defaultTaskOptions) as any)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Fork from message with image
			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 1000,
			})

			// Should preserve images in forked messages
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining("cline_messages.json"),
				expect.stringContaining('"images":["data:image/png;base64,abc123"]'),
				"utf8",
			)
		})

		test("handles file system errors gracefully", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
			] as ClineMessage[]

			const mockApiHistory = [{ ts: 1000, role: "user", content: "First message" }] as any[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory
			await provider.addClineToStack(mockCline)

			// Mock file system error
			vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error("Permission denied"))

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Should handle error gracefully
			await expect(
				messageHandler({
					type: "forkTaskFromMessage",
					timestamp: 1000,
				}),
			).resolves.toBeUndefined()

			// Should show error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("Failed to fork task"))
		})

		test("preserves task metadata in forked task", async () => {
			const mockMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "First message" },
			] as ClineMessage[]

			const mockApiHistory = [{ ts: 1000, role: "user", content: "First message" }] as any[]

			const mockCline = new Task(defaultTaskOptions)
			mockCline.clineMessages = mockMessages
			mockCline.apiConversationHistory = mockApiHistory

			// Set some metadata on the original task
			;(mockCline as any).mode = "architect"
			;(mockCline as any).customInstructions = "Test instructions"

			await provider.addClineToStack(mockCline)

			// Mock getState to return current mode
			vi.spyOn(provider, "getState").mockResolvedValue({
				mode: "architect",
				customInstructions: "Test instructions",
			} as any)

			const createTaskSpy = vi
				.spyOn(provider, "createTaskWithHistoryItem")
				.mockResolvedValue(new Task(defaultTaskOptions) as any)

			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			await messageHandler({
				type: "forkTaskFromMessage",
				timestamp: 1000,
			})

			// Should preserve mode in forked task
			expect(createTaskSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "architect",
				}),
			)
		})
	})
})
