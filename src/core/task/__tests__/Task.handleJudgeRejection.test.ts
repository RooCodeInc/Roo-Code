import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import { JudgeResult } from "../../judge/types"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureLlmCompletion: vi.fn(),
			captureMemoryUsage: vi.fn(),
		},
	},
}))

// Mock dependencies
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
	RelativePattern: vi.fn(),
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

describe("Task.handleJudgeRejection", () => {
	let task: Task
	let mockProvider: any
	let mockContext: any

	const mockJudgeResult: JudgeResult = {
		approved: false,
		reasoning: "The task is not complete because the tests are failing.",
		suggestions: ["Fix the failing tests", "Add error handling"],
		missingItems: ["Test coverage for edge cases"],
		overallScore: 3,
		hasCriticalIssues: false,
	}

	beforeEach(() => {
		mockContext = {
			subscriptions: [],
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			globalStorageUri: {
				fsPath: "/test/storage",
			},
		}

		mockProvider = {
			postMessageToWebview: vi.fn(),
			postStateToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({}),
			context: mockContext,
		}

		// Create a minimal Task instance using TaskOptions
		task = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "test task",
			startTask: false, // Don't start the task automatically in tests
		})

		// Mock the ask method to simulate user response
		vi.spyOn(task, "ask").mockResolvedValue({
			response: "yesButtonClicked",
			text: "",
			images: [],
		})

		// Mock the say method
		vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Mock getJudgeConfig
		vi.spyOn(task as any, "getJudgeConfig").mockResolvedValue({
			enabled: true,
			mode: "always",
			detailLevel: "concise",
			allowUserOverride: true,
			blockOnCriticalIssues: true,
		})
	})

	it("should format and display judge feedback", async () => {
		await task.handleJudgeRejection(mockJudgeResult)

		// Verify that say was called with formatted feedback
		// Note: The feedback is combined into a single call now
		expect(task.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("🧑‍⚖️ Judge Feedback"),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: false },
		)

		expect(task.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("Decision"),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: false },
		)

		expect(task.say).toHaveBeenCalledWith(
			"text",
			expect.stringContaining("Task completion rejected"),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: false },
		)
	})

	it("should call ask with proper followup data including suggestions", async () => {
		await task.handleJudgeRejection(mockJudgeResult)

		// Verify that ask was called with followup type and JSON string containing suggestions
		expect(task.ask).toHaveBeenCalledWith("followup", expect.stringContaining("question"), false)

		// Extract the JSON argument passed to ask
		const askCall = (task.ask as any).mock.calls[0]
		const followUpDataJson = askCall[1]
		const followUpData = JSON.parse(followUpDataJson)

		// Verify the structure of followUpData
		expect(followUpData).toHaveProperty("question")
		expect(followUpData).toHaveProperty("suggest")
		expect(followUpData.suggest).toBeInstanceOf(Array)
		expect(followUpData.suggest.length).toBeGreaterThan(0)

		// Verify suggestion items have required structure
		followUpData.suggest.forEach((suggestion: any) => {
			expect(suggestion).toHaveProperty("answer")
			expect(typeof suggestion.answer).toBe("string")
		})
	})

	it("should provide two suggestion options", async () => {
		await task.handleJudgeRejection(mockJudgeResult)

		const askCall = (task.ask as any).mock.calls[0]
		const followUpDataJson = askCall[1]
		const followUpData = JSON.parse(followUpDataJson)

		// Should have two options: continue or complete anyway
		expect(followUpData.suggest).toHaveLength(2)
		expect(followUpData.suggest[0].answer).toContain("continue")
		expect(followUpData.suggest[1].answer).toContain("complete")
	})

	it("should handle user choosing to continue working", async () => {
		// Mock user selecting "Yes, continue"
		vi.spyOn(task, "ask").mockResolvedValue({
			response: "yesButtonClicked",
			text: "",
			images: [],
		})

		await task.handleJudgeRejection(mockJudgeResult)

		// Should continue the task (not throw, not complete)
		expect(task.ask).toHaveBeenCalled()
	})

	it("should handle user choosing to complete anyway", async () => {
		// Mock user selecting "No, complete anyway"
		vi.spyOn(task, "ask").mockResolvedValue({
			response: "noButtonClicked",
			text: "",
			images: [],
		})

		await task.handleJudgeRejection(mockJudgeResult)

		// Should not throw
		expect(task.ask).toHaveBeenCalled()
	})

	it("should skip user prompt when allowUserOverride is false", async () => {
		// Mock getJudgeConfig to return allowUserOverride: false
		vi.spyOn(task as any, "getJudgeConfig").mockResolvedValue({
			enabled: true,
			mode: "always",
			detailLevel: "concise",
			allowUserOverride: false,
			blockOnCriticalIssues: true,
		})

		// Reset the ask mock
		vi.spyOn(task, "ask").mockClear()

		await task.handleJudgeRejection(mockJudgeResult)

		// Should NOT call ask when allowUserOverride is false
		expect(task.ask).not.toHaveBeenCalled()
	})

	it("should include judge reasoning in feedback", async () => {
		await task.handleJudgeRejection(mockJudgeResult)

		const sayCall = (task.say as any).mock.calls[0]
		const feedbackText = sayCall[1]

		expect(feedbackText).toContain(mockJudgeResult.reasoning)
	})

	it("should include judge suggestions in feedback", async () => {
		await task.handleJudgeRejection(mockJudgeResult)

		const sayCall = (task.say as any).mock.calls[0]
		const feedbackText = sayCall[1]

		mockJudgeResult.suggestions?.forEach((suggestion) => {
			expect(feedbackText).toContain(suggestion)
		})
	})

	it("should handle judge result without suggestions", async () => {
		const resultWithoutSuggestions: JudgeResult = {
			approved: false,
			reasoning: "Task incomplete",
			missingItems: [],
			suggestions: [],
			overallScore: 2,
			hasCriticalIssues: false,
		}

		await task.handleJudgeRejection(resultWithoutSuggestions)

		// Should not throw
		expect(task.say).toHaveBeenCalled()
		expect(task.ask).toHaveBeenCalled()
	})
})
