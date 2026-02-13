// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-unknown-tool.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
	isValidToolName: vi.fn(() => false),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

describe("presentAssistantMessage - Unknown Tool Handling", () => {
	let mockTask: any

	beforeEach(() => {
		// Create a mock Task with minimal properties needed for testing
		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			userMessageContent: [],
			pendingToolResults: [],
			didCompleteReadingStream: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			consecutiveMistakeCount: 0,
			clineMessages: [],
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
					}),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}

		// Add pushToolResultToUserContent method after mockTask is created so 'this' binds correctly
		mockTask.pushToolResultToUserContent = vi.fn().mockImplementation((toolResult: any) => {
			const existingResult = mockTask.pendingToolResults.find(
				(block: any) => block.type === "tool-result" && block.toolCallId === toolResult.toolCallId,
			)
			if (existingResult) {
				return false
			}
			mockTask.pendingToolResults.push(toolResult)
			return true
		})
	})

	it("should return error for unknown tool in native protocol", async () => {
		// Set up a tool_use block with an unknown tool name and an ID (native tool calling)
		const toolCallId = "tool_call_unknown_123"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId, // ID indicates native tool calling
				name: "nonexistent_tool",
				params: { some: "param" },
				partial: false,
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// Verify that a tool-result with error was pushed to pendingToolResults
		const toolResult = mockTask.pendingToolResults.find(
			(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
		)

		expect(toolResult).toBeDefined()
		expect(toolResult.toolCallId).toBe(toolCallId)
		// The error is wrapped in output.value by formatResponse.toolError
		expect(toolResult.output.value).toContain("nonexistent_tool")
		expect(toolResult.output.value).toContain("does not exist")
		expect(toolResult.output.value).toContain("error")

		// Verify consecutiveMistakeCount was incremented
		expect(mockTask.consecutiveMistakeCount).toBe(1)

		// Verify recordToolError was called
		expect(mockTask.recordToolError).toHaveBeenCalledWith(
			"nonexistent_tool",
			expect.stringContaining("Unknown tool"),
		)

		// Verify error message was shown to user (uses i18n key)
		expect(mockTask.say).toHaveBeenCalledWith("error", "unknownToolError")
	})

	it("should fail fast when tool_use is missing id (legacy/XML-style tool call)", async () => {
		// tool_use without an id is treated as legacy/XML-style tool call and must be rejected.
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				name: "fake_tool_that_does_not_exist",
				params: { param1: "value1" },
				partial: false,
			},
		]

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// Should not execute tool; should surface a clear error message.
		const textBlocks = mockTask.userMessageContent.filter((item: any) => item.type === "text")
		expect(textBlocks.length).toBeGreaterThan(0)
		expect(textBlocks.some((b: any) => String(b.text).includes("XML tool calls are no longer supported"))).toBe(
			true,
		)

		// Verify consecutiveMistakeCount was incremented
		expect(mockTask.consecutiveMistakeCount).toBe(1)

		// Verify recordToolError was called
		expect(mockTask.recordToolError).toHaveBeenCalled()

		// Verify error message was shown to user
		expect(mockTask.say).toHaveBeenCalledWith("error", expect.anything())
	})

	it("should handle unknown tool without freezing (native tool calling)", async () => {
		// This test ensures the extension doesn't freeze when an unknown tool is called
		const toolCallId = "tool_call_freeze_test"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId, // Native tool calling
				name: "this_tool_definitely_does_not_exist",
				params: {},
				partial: false,
			},
		]

		// The test will timeout if the extension freezes
		const timeoutPromise = new Promise<boolean>((_, reject) => {
			setTimeout(() => reject(new Error("Test timed out - extension likely froze")), 5000)
		})

		const resultPromise = presentAssistantMessage(mockTask).then(() => true)

		// Race between the function completing and the timeout
		const completed = await Promise.race([resultPromise, timeoutPromise])
		expect(completed).toBe(true)

		// Verify a tool-result was pushed (critical for API not to freeze)
		const toolResult = mockTask.pendingToolResults.find(
			(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
		)
		expect(toolResult).toBeDefined()
	})

	it("should increment consecutiveMistakeCount for unknown tools", async () => {
		// Test with multiple unknown tools to ensure mistake count increments
		const toolCallId = "tool_call_mistake_test"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "unknown_tool_1",
				params: {},
				partial: false,
			},
		]

		expect(mockTask.consecutiveMistakeCount).toBe(0)

		await presentAssistantMessage(mockTask)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
	})

	it("should set userMessageContentReady after handling unknown tool", async () => {
		const toolCallId = "tool_call_ready_test"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "unknown_tool",
				params: {},
				partial: false,
			},
		]

		mockTask.didCompleteReadingStream = true
		mockTask.userMessageContentReady = false

		await presentAssistantMessage(mockTask)

		// userMessageContentReady should be set after processing
		expect(mockTask.userMessageContentReady).toBe(true)
	})

	it("should still work with didRejectTool flag for unknown tool", async () => {
		const toolCallId = "tool_call_rejected_test"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "unknown_tool",
				params: {},
				partial: false,
			},
		]

		mockTask.didRejectTool = true

		await presentAssistantMessage(mockTask)

		// When didRejectTool is true, should send error tool-result
		const toolResult = mockTask.pendingToolResults.find(
			(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
		)

		expect(toolResult).toBeDefined()
		expect(toolResult.output.value).toContain("[ERROR]")
		expect(toolResult.output.value).toContain("due to user rejecting a previous tool")
	})
})
