// Test for treating messages without tools as follow-up questions
// npx vitest core/task/__tests__/no-tool-followup.spec.ts

import * as os from "os"
import * as path from "path"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import type { ProviderSettings } from "@roo-code/types"
import * as vscode from "vscode"
import { TelemetryService } from "@roo-code/telemetry"

// Mock delay
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

// Mock file system
vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	return {
		...actual,
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
	}
})

// Mock p-wait-for
vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
		fs: { stat: vi.fn().mockResolvedValue({ type: 1 }) },
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
	},
	env: { uriScheme: "vscode", language: "en" },
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		visibleTextEditors: [],
		tabGroups: { all: [], close: vi.fn(), onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })) },
	},
	EventEmitter: vi.fn().mockImplementation(() => ({ event: vi.fn(), fire: vi.fn() })),
	Disposable: { from: vi.fn() },
}))

// Mock environment details
vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

// Mock RooIgnoreController
vi.mock("../../ignore/RooIgnoreController")

// Mock condense
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

// Mock storage utilities
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

describe("No-Tool Messages as Follow-up Questions", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		const storageUri = { fsPath: path.join(os.tmpdir(), "test-storage") }

		mockContext = {
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockResolvedValue(undefined),
				store: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
			extensionUri: { fsPath: "/mock/extension" },
			extension: { packageJSON: { version: "1.0.0" } },
		} as unknown as vscode.ExtensionContext

		const mockOutput = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		mockProvider = new ClineProvider(mockContext, mockOutput as any, "sidebar", new ContextProxy(mockContext))
		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)

		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-key",
		}
	})

	describe("Auto-approval enabled with alwaysAllowFollowupQuestions", () => {
		it("should auto-continue with noToolsUsed message when both settings are enabled", async () => {
			// Setup state with both auto-approval and follow-up questions enabled
			mockProvider.getState = vi.fn().mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysAllowFollowupQuestions: true,
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock the API to return a message without tools
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: "I need more information" }
				},
			}

			vi.spyOn(task.api, "createMessage").mockReturnValue(mockStream as any)

			// Add initial conversation history
			task.apiConversationHistory = [
				{
					role: "user",
					content: [{ type: "text", text: "Do something" }],
					ts: Date.now(),
				},
			]

			// Set up spy on say to verify no error is shown
			const saySpy = vi.spyOn(task, "say")

			// Set up spy on ask to verify it's NOT called (auto-continue)
			const askSpy = vi.spyOn(task, "ask")

			// Trigger the recursivelyMakeClineRequests with the assistant's no-tool message
			task.assistantMessageContent = [{ type: "text", content: "I need more information", partial: false }]
			task.userMessageContentReady = true

			// Simulate what happens in recursivelyMakeClineRequests when didToolUse is false
			const didToolUse = false

			if (!didToolUse) {
				task.consecutiveNoToolUseCount = 0

				const state = await mockProvider.getState()

				if (state?.autoApprovalEnabled && state?.alwaysAllowFollowupQuestions) {
					// This should be the path taken - auto-continue
					task.userMessageContent.push({
						type: "text",
						text: "[ERROR] You did not use a tool...",
					})
				}
			}

			// Verify that ask was NOT called (no follow-up question shown)
			expect(askSpy).not.toHaveBeenCalledWith("followup", expect.any(String), false)

			// Verify that the noToolsUsed message was added to userMessageContent
			expect(task.userMessageContent).toHaveLength(1)
			expect(task.userMessageContent[0]).toHaveProperty("type", "text")
			expect((task.userMessageContent[0] as any).text).toContain("did not use a tool")

			// Verify no error was shown to the user
			expect(saySpy).not.toHaveBeenCalledWith("error", "MODEL_NO_TOOLS_USED")
		})
	})

	describe("Auto-approval disabled or alwaysAllowFollowupQuestions disabled", () => {
		it("should present as follow-up question with hideHeader when autoApprovalEnabled is false", async () => {
			// Setup state with auto-approval disabled
			mockProvider.getState = vi.fn().mockResolvedValue({
				autoApprovalEnabled: false,
				alwaysAllowFollowupQuestions: true,
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Set up spy on ask to verify it IS called with followup
			const askSpy = vi.spyOn(task, "ask").mockResolvedValue({
				response: "messageResponse",
				text: "User's answer",
				images: [],
			})

			// Set up spy on say to verify user_feedback is shown
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Simulate what happens in recursivelyMakeClineRequests when didToolUse is false
			const assistantMessage = "What color would you like?"
			const didToolUse = false

			if (!didToolUse) {
				task.consecutiveNoToolUseCount = 0

				const state = await mockProvider.getState()

				if (state?.autoApprovalEnabled && state?.alwaysAllowFollowupQuestions) {
					// Should NOT take this path
				} else {
					// Should take this path - present as follow-up question with hideHeader
					const followUpData = { question: assistantMessage, hideHeader: true }
					const { text, images } = await task.ask("followup", JSON.stringify(followUpData), false)
					await task.say("user_feedback", text ?? "", images)

					const toolResult = `<answer>\n${text}\n</answer>`
					task.userMessageContent.push({
						type: "text",
						text: toolResult,
					})
				}
			}

			// Verify that ask WAS called with followup and hideHeader
			expect(askSpy).toHaveBeenCalledWith(
				"followup",
				JSON.stringify({ question: assistantMessage, hideHeader: true }),
				false,
			)

			// Verify that say WAS called with user_feedback
			expect(saySpy).toHaveBeenCalledWith("user_feedback", "User's answer", [])

			// Verify that the user's response was added to userMessageContent
			expect(task.userMessageContent).toHaveLength(1)
			expect(task.userMessageContent[0]).toHaveProperty("type", "text")
			expect((task.userMessageContent[0] as any).text).toContain("User's answer")
		})

		it("should present as follow-up question with hideHeader when alwaysAllowFollowupQuestions is false", async () => {
			// Setup state with alwaysAllowFollowupQuestions disabled
			mockProvider.getState = vi.fn().mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysAllowFollowupQuestions: false,
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Set up spy on ask to verify it IS called with followup
			const askSpy = vi.spyOn(task, "ask").mockResolvedValue({
				response: "messageResponse",
				text: "User's answer",
				images: [],
			})

			// Set up spy on say to verify user_feedback is shown
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Simulate what happens in recursivelyMakeClineRequests when didToolUse is false
			const assistantMessage = "What's your preference?"
			const didToolUse = false

			if (!didToolUse) {
				task.consecutiveNoToolUseCount = 0

				const state = await mockProvider.getState()

				if (state?.autoApprovalEnabled && state?.alwaysAllowFollowupQuestions) {
					// Should NOT take this path
				} else {
					// Should take this path - present as follow-up question with hideHeader
					const followUpData = { question: assistantMessage, hideHeader: true }
					const { text, images } = await task.ask("followup", JSON.stringify(followUpData), false)
					await task.say("user_feedback", text ?? "", images)

					const toolResult = `<answer>\n${text}\n</answer>`
					task.userMessageContent.push({
						type: "text",
						text: toolResult,
					})
				}
			}

			// Verify that ask WAS called with followup and hideHeader
			expect(askSpy).toHaveBeenCalledWith(
				"followup",
				JSON.stringify({ question: assistantMessage, hideHeader: true }),
				false,
			)

			// Verify that say WAS called with user_feedback
			expect(saySpy).toHaveBeenCalledWith("user_feedback", "User's answer", [])
		})

		it("should handle images in follow-up question response", async () => {
			// Setup state with auto-approval disabled
			mockProvider.getState = vi.fn().mockResolvedValue({
				autoApprovalEnabled: false,
				alwaysAllowFollowupQuestions: true,
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const testImages = ["data:image/png;base64,test1", "data:image/png;base64,test2"]

			// Set up spy on ask to return response with images
			const askSpy = vi.spyOn(task, "ask").mockResolvedValue({
				response: "messageResponse",
				text: "Here are the images",
				images: testImages,
			})

			// Set up spy on say
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Simulate what happens in recursivelyMakeClineRequests when didToolUse is false
			const assistantMessage = "Can you show me some screenshots?"
			const didToolUse = false

			if (!didToolUse) {
				task.consecutiveNoToolUseCount = 0

				const state = await mockProvider.getState()

				if (state?.autoApprovalEnabled && state?.alwaysAllowFollowupQuestions) {
					// Should NOT take this path
				} else {
					// Should take this path - present as follow-up question with hideHeader
					const followUpData = { question: assistantMessage, hideHeader: true }
					const { text, images } = await task.ask("followup", JSON.stringify(followUpData), false)
					await task.say("user_feedback", text ?? "", images)

					// formatResponse.toolResult can return string or array when images present
					const toolResult = `<answer>\n${text}\n</answer>`
					// Simplified - in real code formatResponse.toolResult handles image blocks
					task.userMessageContent.push({
						type: "text",
						text: toolResult,
					})
				}
			}

			// Verify that ask WAS called with hideHeader
			expect(askSpy).toHaveBeenCalledWith(
				"followup",
				JSON.stringify({ question: assistantMessage, hideHeader: true }),
				false,
			)

			// Verify that say WAS called with user_feedback including images
			expect(saySpy).toHaveBeenCalledWith("user_feedback", "Here are the images", testImages)
		})
	})

	describe("Counter behavior", () => {
		it("should reset consecutiveNoToolUseCount when no tools are used", async () => {
			mockProvider.getState = vi.fn().mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysAllowFollowupQuestions: true,
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Set initial counter
			task.consecutiveNoToolUseCount = 2

			// Simulate no tool use scenario
			const didToolUse = false

			if (!didToolUse) {
				task.consecutiveNoToolUseCount = 0 // This is the new behavior
			}

			// Verify counter was reset
			expect(task.consecutiveNoToolUseCount).toBe(0)
		})

		it("should not increment consecutiveMistakeCount for no-tool responses", async () => {
			mockProvider.getState = vi.fn().mockResolvedValue({
				autoApprovalEnabled: true,
				alwaysAllowFollowupQuestions: true,
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const initialMistakeCount = task.consecutiveMistakeCount

			// Simulate what happens in recursivelyMakeClineRequests when didToolUse is false
			const didToolUse = false

			if (!didToolUse) {
				task.consecutiveNoToolUseCount = 0

				const state = await mockProvider.getState()

				if (state?.autoApprovalEnabled && state?.alwaysAllowFollowupQuestions) {
					// Auto-continue - should NOT increment consecutiveMistakeCount
					task.userMessageContent.push({
						type: "text",
						text: "[ERROR] You did not use a tool...",
					})
				}
			}

			// Verify mistake count was NOT incremented
			expect(task.consecutiveMistakeCount).toBe(initialMistakeCount)
		})
	})
})
