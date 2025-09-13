// npx vitest src/core/task/__tests__/Task.handleContextWindowExceeded.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import * as slidingWindow from "../../sliding-window"
import { TelemetryService } from "@roo-code/telemetry"

// Mock vscode module
vi.mock("vscode", () => ({
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
		fs: {
			stat: vi.fn().mockResolvedValue({ type: 1 }),
		},
		getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
	},
}))

// Mock dependencies
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

// Mock RooIgnoreController
vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
		getInstructions: vi.fn().mockReturnValue(""),
	})),
}))

// Mock RooProtectedController
vi.mock("../../protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	})),
}))

// Mock FileContextTracker
vi.mock("../../context-tracking/FileContextTracker", () => ({
	FileContextTracker: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))

// Mock other dependencies
vi.mock("../../../services/browser/UrlContentFetcher", () => ({
	UrlContentFetcher: vi.fn().mockImplementation(() => ({
		closeBrowser: vi.fn(),
	})),
}))

vi.mock("../../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		closeBrowser: vi.fn(),
	})),
}))

vi.mock("../../../integrations/editor/DiffViewProvider", () => ({
	DiffViewProvider: vi.fn().mockImplementation(() => ({
		reset: vi.fn(),
		isEditing: false,
	})),
}))

vi.mock("../AutoApprovalHandler", () => ({
	AutoApprovalHandler: vi.fn().mockImplementation(() => ({})),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockImplementation(() => ({
		getModel: vi.fn().mockReturnValue({
			id: "test-model",
			info: {
				contextWindow: 100000,
				maxTokens: 4096,
			},
		}),
		createMessage: vi.fn(),
	})),
}))

vi.mock("../../assistant-message/AssistantMessageParser", () => ({
	AssistantMessageParser: vi.fn().mockImplementation(() => ({
		reset: vi.fn(),
		processChunk: vi.fn(),
		getContentBlocks: vi.fn().mockReturnValue([]),
	})),
}))

vi.mock("../../message-queue/MessageQueueService", () => ({
	MessageQueueService: vi.fn().mockImplementation(() => ({
		on: vi.fn(),
		removeListener: vi.fn(),
		dispose: vi.fn(),
		isEmpty: vi.fn().mockReturnValue(true),
	})),
}))

vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))

vi.mock("../../tools/ToolRepetitionDetector", () => ({
	ToolRepetitionDetector: vi.fn().mockImplementation(() => ({})),
}))

vi.mock("../../diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getName: vi.fn().mockReturnValue("MultiSearchReplace"),
	})),
}))

vi.mock("../../sliding-window", () => ({
	truncateConversationIfNeeded: vi.fn().mockResolvedValue({
		messages: [],
		summary: "",
		cost: 0,
		prevContextTokens: 0,
	}),
}))

vi.mock("../../../shared/api", () => ({
	getModelMaxOutputTokens: vi.fn().mockReturnValue(4096),
}))

describe("Task.handleContextWindowExceededError", () => {
	let mockProvider: any
	let mockApiConfig: any
	let task: Task

	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		mockApiConfig = {
			apiProvider: "anthropic",
			apiKey: "test-key",
			apiModelId: "claude-3-sonnet",
		}

		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
			},
			getState: vi.fn(),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		}

		// Create task instance
		task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Mock the API model info
		vi.spyOn(task.api, "getModel").mockReturnValue({
			id: "claude-3-sonnet",
			info: {
				contextWindow: 100000,
				maxTokens: 4096,
				supportsImages: true,
				supportsPromptCache: true,
			},
		})

		// Mock getTokenUsage
		vi.spyOn(task, "getTokenUsage").mockReturnValue({
			contextTokens: 80000,
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCost: 0,
		})

		// Mock getSystemPrompt
		vi.spyOn(task as any, "getSystemPrompt").mockResolvedValue("System prompt")

		// Mock getCurrentProfileId
		vi.spyOn(task as any, "getCurrentProfileId").mockReturnValue("default")
	})

	it("should respect user settings when autoCondenseContext is false", async () => {
		// Setup: Configure state with autoCondenseContext disabled
		mockProvider.getState.mockResolvedValue({
			autoCondenseContext: false,
			autoCondenseContextPercent: 100,
			profileThresholds: {},
		})

		// Mock truncateConversationIfNeeded to track calls
		const truncateSpy = vi.spyOn(slidingWindow, "truncateConversationIfNeeded")

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify truncateConversationIfNeeded was called with autoCondenseContext: false
		expect(truncateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				autoCondenseContext: false,
				autoCondenseContextPercent: 100,
			}),
		)

		// Verify it wasn't forced to true
		const callArgs = truncateSpy.mock.calls[0][0]
		expect(callArgs.autoCondenseContext).toBe(false)
	})

	it("should respect user settings when autoCondenseContext is true", async () => {
		// Setup: Configure state with autoCondenseContext enabled
		mockProvider.getState.mockResolvedValue({
			autoCondenseContext: true,
			autoCondenseContextPercent: 75,
			profileThresholds: {},
		})

		// Mock truncateConversationIfNeeded to track calls
		const truncateSpy = vi.spyOn(slidingWindow, "truncateConversationIfNeeded")

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify truncateConversationIfNeeded was called with user's settings
		expect(truncateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				autoCondenseContext: true,
				autoCondenseContextPercent: 75,
			}),
		)
	})

	it("should use default values when state is undefined", async () => {
		// Setup: Configure state to return undefined
		mockProvider.getState.mockResolvedValue(undefined)

		// Mock truncateConversationIfNeeded to track calls
		const truncateSpy = vi.spyOn(slidingWindow, "truncateConversationIfNeeded")

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify truncateConversationIfNeeded was called with default values
		expect(truncateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				autoCondenseContext: true, // Default value
				autoCondenseContextPercent: 100, // Default value
			}),
		)
	})

	it("should log appropriate message based on autoCondenseContext setting", async () => {
		// Setup: Configure state with autoCondenseContext disabled
		mockProvider.getState.mockResolvedValue({
			autoCondenseContext: false,
			autoCondenseContextPercent: 50,
			profileThresholds: {},
		})

		// Spy on console.warn to verify log message
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify the log message includes the actual settings
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Auto-condense: false, Threshold: 50%"))

		// Cleanup
		consoleWarnSpy.mockRestore()
	})

	it("should handle context window exceeded with custom percentage", async () => {
		// Setup: Configure state with custom percentage
		mockProvider.getState.mockResolvedValue({
			autoCondenseContext: true,
			autoCondenseContextPercent: 60,
			profileThresholds: {},
		})

		// Mock truncateConversationIfNeeded to track calls
		const truncateSpy = vi.spyOn(slidingWindow, "truncateConversationIfNeeded")

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify the custom percentage was used
		expect(truncateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				autoCondenseContext: true,
				autoCondenseContextPercent: 60,
			}),
		)
	})

	it("should emit condense_context message when truncation returns a summary", async () => {
		// Setup: Configure state and mock truncation to return a summary
		mockProvider.getState.mockResolvedValue({
			autoCondenseContext: true,
			autoCondenseContextPercent: 75,
			profileThresholds: {},
		})

		const mockTruncateResult = {
			messages: [{ role: "user" as const, content: "truncated" }],
			summary: "This is a summary",
			cost: 0.05,
			prevContextTokens: 80000,
			newContextTokens: 20000,
		}

		vi.spyOn(slidingWindow, "truncateConversationIfNeeded").mockResolvedValue(mockTruncateResult)

		// Spy on say method
		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify say was called with condense_context
		expect(saySpy).toHaveBeenCalledWith(
			"condense_context",
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
			expect.objectContaining({
				summary: "This is a summary",
				cost: 0.05,
				newContextTokens: 20000,
				prevContextTokens: 80000,
			}),
		)
	})

	it("should not emit condense_context when no summary is returned", async () => {
		// Setup: Configure state and mock truncation to return no summary
		mockProvider.getState.mockResolvedValue({
			autoCondenseContext: false,
			autoCondenseContextPercent: 100,
			profileThresholds: {},
		})

		const mockTruncateResult = {
			messages: [{ role: "user" as const, content: "truncated" }],
			summary: "", // No summary
			cost: 0,
			prevContextTokens: 80000,
		}

		vi.spyOn(slidingWindow, "truncateConversationIfNeeded").mockResolvedValue(mockTruncateResult)

		// Spy on say method
		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Act: Call handleContextWindowExceededError
		await (task as any).handleContextWindowExceededError()

		// Assert: Verify say was not called with condense_context
		expect(saySpy).not.toHaveBeenCalledWith(
			"condense_context",
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
		)
	})
})
