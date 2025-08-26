import { describe, it, expect, vi, beforeEach } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"
import { Task } from "../../task/Task"
import { updateTodoListTool } from "../../tools/updateTodoListTool"
import { readFileTool } from "../../tools/readFileTool"

vi.mock("../../tools/updateTodoListTool")
vi.mock("../../tools/readFileTool")
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
		hasInstance: () => true,
	},
}))

describe("presentAssistantMessage - Multi-tool execution", () => {
	let mockTask: Task
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Create a minimal mock task
		mockTask = {
			taskId: "test-task",
			instanceId: "test-instance",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			didCompleteReadingStream: false,
			userMessageContentReady: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			userMessageContent: [],
			say: vi.fn(),
			ask: vi.fn(),
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			consecutiveMistakeCount: 0,
			clineMessages: [],
			apiConversationHistory: [],
			todoList: [],
			checkpointSave: vi.fn(),
			currentStreamingDidCheckpoint: false,
			browserSession: { closeBrowser: vi.fn() },
			toolRepetitionDetector: { check: vi.fn(() => ({ allowExecution: true })) },
			providerRef: { deref: vi.fn(() => ({ getState: vi.fn(() => ({ mode: "code" })) })) },
			api: { getModel: vi.fn(() => ({ id: "test-model" })) },
		} as any

		mockAskApproval = vi.fn(() => Promise.resolve(true))
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
	})

	it("should allow update_todo_list to execute alongside other tools", async () => {
		// Set up assistant message content with two tools
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				name: "read_file",
				params: { path: "test.txt" },
				partial: false,
			},
			{
				type: "tool_use",
				name: "update_todo_list",
				params: { todos: "[ ] Test todo" },
				partial: false,
			},
		]

		// Mock the tool implementations
		vi.mocked(readFileTool).mockImplementation(async (cline, block, askApproval, handleError, pushToolResult) => {
			pushToolResult("File content")
		})

		vi.mocked(updateTodoListTool).mockImplementation(
			async (cline, block, askApproval, handleError, pushToolResult) => {
				pushToolResult("Todo list updated")
			},
		)

		// Process first tool
		mockTask.currentStreamingContentIndex = 0
		await presentAssistantMessage(mockTask)

		// After first tool, didAlreadyUseTool should be true
		expect(mockTask.didAlreadyUseTool).toBe(true)

		// Process second tool (update_todo_list)
		mockTask.currentStreamingContentIndex = 1
		await presentAssistantMessage(mockTask)

		// Both tools should have been executed
		expect(readFileTool).toHaveBeenCalledTimes(1)
		expect(updateTodoListTool).toHaveBeenCalledTimes(1)

		// Check that both tool results were pushed
		// The first two entries should be for read_file
		expect(mockTask.userMessageContent[0]).toEqual({
			type: "text",
			text: expect.stringContaining("Result:"),
		})
		expect(mockTask.userMessageContent[1]).toEqual({
			type: "text",
			text: "File content",
		})
		// The next two entries should be for update_todo_list
		expect(mockTask.userMessageContent[2]).toEqual({
			type: "text",
			text: "[update_todo_list] Result:",
		})
		expect(mockTask.userMessageContent[3]).toEqual({
			type: "text",
			text: "Todo list updated",
		})
	})

	it("should block non-update_todo_list tools after a tool has been used", async () => {
		// Set up assistant message content with two non-update_todo_list tools
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				name: "read_file",
				params: { path: "test.txt" },
				partial: false,
			},
			{
				type: "tool_use",
				name: "write_to_file",
				params: { path: "test.txt", content: "new content" },
				partial: false,
			},
		]

		// Mock the read_file tool
		vi.mocked(readFileTool).mockImplementation(async (cline, block, askApproval, handleError, pushToolResult) => {
			pushToolResult("File content")
		})

		// Process first tool
		mockTask.currentStreamingContentIndex = 0
		await presentAssistantMessage(mockTask)

		// After first tool, didAlreadyUseTool should be true
		expect(mockTask.didAlreadyUseTool).toBe(true)

		// Process second tool (should be blocked)
		mockTask.currentStreamingContentIndex = 1
		await presentAssistantMessage(mockTask)

		// Only the first tool should have been executed
		expect(readFileTool).toHaveBeenCalledTimes(1)

		// Check that the second tool was blocked
		expect(mockTask.userMessageContent).toContainEqual(
			expect.objectContaining({
				type: "text",
				text: expect.stringContaining(
					"Tool [write_to_file] was not executed because a tool has already been used",
				),
			}),
		)
	})

	it("should not set didAlreadyUseTool when update_todo_list is executed", async () => {
		// Set up assistant message content with update_todo_list first
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				name: "update_todo_list",
				params: { todos: "[ ] Test todo" },
				partial: false,
			},
		]

		// Mock the tool implementation
		vi.mocked(updateTodoListTool).mockImplementation(
			async (cline, block, askApproval, handleError, pushToolResult) => {
				pushToolResult("Todo list updated")
			},
		)

		// Process the update_todo_list tool
		await presentAssistantMessage(mockTask)

		// didAlreadyUseTool should remain false for update_todo_list
		expect(mockTask.didAlreadyUseTool).toBe(false)
		expect(updateTodoListTool).toHaveBeenCalledTimes(1)
	})
})
