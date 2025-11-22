import { describe, it, expect, beforeEach, vi } from "vitest"
import { Task } from "../Task"
import { AssistantMessageParser } from "../../assistant-message/AssistantMessageParser"
import { resolveToolProtocol } from "../../../utils/resolveToolProtocol"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ApiHandler } from "../../../api"
import { TOOL_PROTOCOL } from "@roo-code/types"

// Mock vscode module
vi.mock("vscode", () => ({
	default: {},
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
		})),
	},
	RelativePattern: class RelativePattern {
		constructor(
			public base: string,
			public pattern: string,
		) {}
	},
	EventEmitter: class EventEmitter {
		fire = vi.fn()
		event = vi.fn()
		dispose = vi.fn()
	},
}))

// Mock other dependencies
vi.mock("../../../utils/resolveToolProtocol")
vi.mock("../../assistant-message/AssistantMessageParser", () => ({
	AssistantMessageParser: vi.fn(() => ({
		processChunk: vi.fn(),
		finalizeContentBlocks: vi.fn(),
		getContentBlocks: vi.fn(),
		reset: vi.fn(),
	})),
}))
vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class RooIgnoreController {
		initialize = vi.fn().mockResolvedValue(undefined)
		dispose = vi.fn()
		getInstructions = vi.fn()
	},
}))
vi.mock("../../protect/RooProtectedController", () => ({
	RooProtectedController: class RooProtectedController {
		dispose = vi.fn()
	},
}))
vi.mock("../../context-tracking/FileContextTracker", () => ({
	FileContextTracker: class FileContextTracker {
		dispose = vi.fn()
	},
}))
vi.mock("../../../services/browser/UrlContentFetcher", () => ({
	UrlContentFetcher: class UrlContentFetcher {
		closeBrowser = vi.fn()
	},
}))
vi.mock("../../../services/browser/BrowserSession", () => ({
	BrowserSession: class BrowserSession {
		closeBrowser = vi.fn()
		isSessionActive = vi.fn().mockReturnValue(false)
	},
}))
vi.mock("../../../integrations/editor/DiffViewProvider", () => ({
	DiffViewProvider: class DiffViewProvider {
		reset = vi.fn()
		revertChanges = vi.fn()
		isEditing = false
	},
}))
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => mockApi),
}))
vi.mock("../../tools/ToolRepetitionDetector", () => ({
	ToolRepetitionDetector: class ToolRepetitionDetector {},
}))
vi.mock("../../message-queue/MessageQueueService", () => ({
	MessageQueueService: class MessageQueueService {
		on = vi.fn()
		removeListener = vi.fn()
		dispose = vi.fn()
		isEmpty = vi.fn().mockReturnValue(true)
		messages = []
	},
}))
vi.mock("../../auto-approval", () => ({
	AutoApprovalHandler: class AutoApprovalHandler {
		checkAutoApprovalLimits = vi.fn()
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

// Need to define mockApi outside beforeEach so it's available to the mock
let mockApi: any

describe("Task Protocol Switching", () => {
	let mockProvider: any

	beforeEach(() => {
		// Reset mockApi before each test
		mockApi = {
			getModel: vi.fn(() => ({
				id: "test-model",
				info: {
					supportsNativeTools: true,
					contextWindow: 100000,
				},
			})),
		}

		// Setup mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
				extensionUri: { fsPath: "/test/extension" },
			},
			getState: vi.fn(),
			postStateToWebview: vi.fn(),
			postMessageToWebview: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			log: vi.fn(),
			updateTaskHistory: vi.fn(),
			providerSettingsManager: {
				getProfile: vi.fn(),
			},
		}

		// Setup default return values
		mockProvider.getState.mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic",
				toolProtocol: TOOL_PROTOCOL.NATIVE,
			},
		})
	})

	it("should dynamically check protocol during streaming when switching from Native to XML", async () => {
		// Start with Native protocol
		const mockResolveToolProtocol = vi.mocked(resolveToolProtocol)
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.NATIVE)

		// Create task with Native protocol
		const task = new Task({
			provider: mockProvider as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				toolProtocol: TOOL_PROTOCOL.NATIVE,
			},
			task: "Test task",
		})

		// Verify parser is not created for native protocol
		expect(task.assistantMessageParser).toBeUndefined()

		// Simulate profile switch to XML protocol
		await task.updateApiConfiguration({
			apiProvider: "anthropic",
			toolProtocol: TOOL_PROTOCOL.XML,
		})

		// Mock the protocol resolution to return XML after switch
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.XML)

		// Verify parser is created after switch to XML
		expect(task.assistantMessageParser).toBeDefined()
		expect(task.assistantMessageParser).toBeInstanceOf(AssistantMessageParser)
	})

	it("should handle XML tool calls correctly after switching from Native to XML mid-task", async () => {
		const mockResolveToolProtocol = vi.mocked(resolveToolProtocol)

		// Start with Native protocol
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.NATIVE)

		const task = new Task({
			provider: mockProvider as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				toolProtocol: TOOL_PROTOCOL.NATIVE,
			},
			task: "Test task",
		})

		// Switch to XML protocol mid-task
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.XML)

		await task.updateApiConfiguration({
			apiProvider: "anthropic",
			toolProtocol: TOOL_PROTOCOL.XML,
		})

		// Mock parser to simulate parsing XML tool calls
		const mockProcessChunk = vi.fn().mockReturnValue([
			{
				type: "tool_use",
				name: "read_file",
				params: { path: "test.txt" },
				partial: false,
			},
		])

		if (task.assistantMessageParser) {
			task.assistantMessageParser.processChunk = mockProcessChunk
		}

		// Simulate receiving XML text chunk that should be parsed as a tool call
		const xmlChunk = "<read_file><path>test.txt</path></read_file>"

		// The protocol should be checked dynamically and use XML parser
		const result = task.assistantMessageParser?.processChunk(xmlChunk)

		expect(mockProcessChunk).toHaveBeenCalledWith(xmlChunk)
		expect(result).toBeDefined()
		expect(result?.[0]).toMatchObject({
			type: "tool_use",
			name: "read_file",
			params: { path: "test.txt" },
		})
	})

	it("should handle switching from XML to Native protocol", async () => {
		const mockResolveToolProtocol = vi.mocked(resolveToolProtocol)

		// Start with XML protocol
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.XML)

		const task = new Task({
			provider: mockProvider as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				toolProtocol: TOOL_PROTOCOL.XML,
			},
			task: "Test task",
		})

		// Verify parser is created for XML protocol
		expect(task.assistantMessageParser).toBeDefined()

		// Switch to Native protocol
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.NATIVE)

		await task.updateApiConfiguration({
			apiProvider: "anthropic",
			toolProtocol: TOOL_PROTOCOL.NATIVE,
		})

		// Verify parser is removed after switch to Native
		expect(task.assistantMessageParser).toBeUndefined()
	})

	it("should not recreate parser if protocol doesn't change", async () => {
		const mockResolveToolProtocol = vi.mocked(resolveToolProtocol)
		mockResolveToolProtocol.mockReturnValue(TOOL_PROTOCOL.XML)

		const task = new Task({
			provider: mockProvider as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				toolProtocol: TOOL_PROTOCOL.XML,
			},
			task: "Test task",
		})

		const originalParser = task.assistantMessageParser

		// Update configuration but keep same protocol
		await task.updateApiConfiguration({
			apiProvider: "anthropic",
			toolProtocol: TOOL_PROTOCOL.XML,
			apiKey: "new-key", // Different property
		})

		// Parser should remain the same instance
		expect(task.assistantMessageParser).toBe(originalParser)
	})
})
