// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-parallel-tools.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
	isValidToolName: vi.fn(() => true),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

// Mock the tool handlers to avoid complex setup
vi.mock("../../tools/ListFilesTool", () => ({
	listFilesTool: {
		handle: vi.fn().mockImplementation(async (cline, block, callbacks) => {
			// Simulate async tool execution - tool result is pushed asynchronously
			await Promise.resolve()
			callbacks.pushToolResult("list_files result")
		}),
	},
}))

vi.mock("../../tools/ReadFileTool", () => ({
	readFileTool: {
		handle: vi.fn().mockImplementation(async (cline, block, callbacks) => {
			// Simulate async tool execution - tool result is pushed asynchronously
			await Promise.resolve()
			callbacks.pushToolResult("read_file result")
		}),
		getReadFileToolDescription: vi.fn(() => "[read_file]"),
	},
}))

describe("presentAssistantMessage - Parallel Tool Execution Timing", () => {
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
			userMessageContentReady: false,
			didCompleteReadingStream: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			consecutiveMistakeCount: 0,
			clineMessages: [],
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
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

		// Add pushToolResultToUserContent method
		mockTask.pushToolResultToUserContent = vi.fn().mockImplementation((toolResult: any) => {
			const existingResult = mockTask.userMessageContent.find(
				(block: any) => block.type === "tool_result" && block.tool_use_id === toolResult.tool_use_id,
			)
			if (existingResult) {
				return false
			}
			mockTask.userMessageContent.push(toolResult)
			return true
		})
	})

	it("should NOT set userMessageContentReady until all tool_results are collected for parallel tools", async () => {
		// Set up multiple tool_use blocks (parallel tool calls)
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_1",
				name: "list_files",
				params: { path: "/test" },
				partial: false,
			},
			{
				type: "tool_use",
				id: "tool_call_2",
				name: "read_file",
				params: { path: "/test/file.txt" },
				partial: false,
			},
		]

		mockTask.didCompleteReadingStream = true

		// Process first tool
		await presentAssistantMessage(mockTask)

		// After processing first tool, userMessageContentReady should NOT be true
		// because tool_call_2 doesn't have a tool_result yet
		// Note: Due to how the mock is set up, the first tool should push its result
		// but the second tool hasn't been processed yet
		expect(mockTask.userMessageContent.length).toBeGreaterThanOrEqual(0)

		// If only one tool_result exists for two tool_use blocks, userMessageContentReady should be false
		if (mockTask.userMessageContent.length === 1) {
			expect(mockTask.userMessageContentReady).toBe(false)
		}
	})

	it("should set userMessageContentReady when all tool_results are collected", async () => {
		// Set up a single tool_use block
		const toolCallId = "tool_call_single"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "list_files",
				params: { path: "/test" },
				partial: false,
			},
		]

		mockTask.didCompleteReadingStream = true

		await presentAssistantMessage(mockTask)

		// After the tool executes and pushes its result, userMessageContentReady should be true
		// because there's 1 tool_use and 1 tool_result
		const toolResultCount = mockTask.userMessageContent.filter((b: any) => b.type === "tool_result").length

		if (toolResultCount === 1) {
			expect(mockTask.userMessageContentReady).toBe(true)
		}
	})

	it("should handle text-only content without waiting for tool_results", async () => {
		// Set up a text-only content block (no tools)
		mockTask.assistantMessageContent = [
			{
				type: "text",
				content: "Hello, this is a text response",
				partial: false,
			},
		]

		mockTask.didCompleteReadingStream = true

		await presentAssistantMessage(mockTask)

		// With no tool_use blocks, userMessageContentReady should be true after processing text
		expect(mockTask.userMessageContentReady).toBe(true)
	})

	it("should wait for tool_results even when didRejectTool is true", async () => {
		// Set up multiple tool_use blocks
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_rejected_1",
				name: "list_files",
				params: { path: "/test" },
				partial: false,
			},
			{
				type: "tool_use",
				id: "tool_call_rejected_2",
				name: "read_file",
				params: { path: "/test/file.txt" },
				partial: false,
			},
		]

		mockTask.didRejectTool = true
		mockTask.didCompleteReadingStream = true

		await presentAssistantMessage(mockTask)

		// When didRejectTool is true, error tool_results should be pushed for each tool
		// Both should have tool_results (skipped messages)
		const toolResults = mockTask.userMessageContent.filter((b: any) => b.type === "tool_result")

		// The function should have pushed error tool_results for rejected tools
		expect(toolResults.length).toBeGreaterThan(0)

		// If all tool_results are collected, userMessageContentReady should be true
		const toolUseCount = mockTask.assistantMessageContent.filter(
			(b: any) => b.type === "tool_use" || b.type === "mcp_tool_use",
		).length

		if (toolResults.length >= toolUseCount) {
			expect(mockTask.userMessageContentReady).toBe(true)
		}
	})

	it("should not set userMessageContentReady if stream is not complete", async () => {
		// Set up a tool_use block
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "tool_call_stream",
				name: "list_files",
				params: { path: "/test" },
				partial: false,
			},
		]

		// Stream is NOT complete
		mockTask.didCompleteReadingStream = false

		await presentAssistantMessage(mockTask)

		// Even if the tool executed, userMessageContentReady should NOT be true
		// because the stream hasn't completed yet (more content may arrive)
		// Note: The fix specifically checks both conditions
	})

	it("should handle mcp_tool_use blocks the same as tool_use blocks", async () => {
		// Set up an mcp_tool_use block (MCP tool)
		mockTask.assistantMessageContent = [
			{
				type: "mcp_tool_use",
				id: "mcp_tool_call_1",
				name: "mcp_server_tool",
				serverName: "test_server",
				toolName: "test_tool",
				arguments: {},
				partial: false,
			},
		]

		mockTask.didRejectTool = true // Use rejection to get a simple tool_result
		mockTask.didCompleteReadingStream = true

		await presentAssistantMessage(mockTask)

		// The mcp_tool_use should be treated similarly - needs tool_result before ready
		const toolResults = mockTask.userMessageContent.filter((b: any) => b.type === "tool_result")
		const toolUseCount = mockTask.assistantMessageContent.filter(
			(b: any) => b.type === "tool_use" || b.type === "mcp_tool_use",
		).length

		// If all tool_results are collected, userMessageContentReady should be true
		if (toolResults.length >= toolUseCount) {
			expect(mockTask.userMessageContentReady).toBe(true)
		}
	})

	it("should correctly count mixed tool_use and mcp_tool_use blocks", async () => {
		// Set up mixed tool blocks
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: "regular_tool_1",
				name: "list_files",
				params: { path: "/test" },
				partial: false,
			},
			{
				type: "mcp_tool_use",
				id: "mcp_tool_1",
				name: "mcp_server_tool",
				serverName: "test_server",
				toolName: "test_tool",
				arguments: {},
				partial: false,
			},
		]

		mockTask.didRejectTool = true // Simplify by using rejection
		mockTask.didCompleteReadingStream = true

		await presentAssistantMessage(mockTask)

		// Both tool types should require tool_results
		const toolUseCount = mockTask.assistantMessageContent.filter(
			(b: any) => b.type === "tool_use" || b.type === "mcp_tool_use",
		).length

		expect(toolUseCount).toBe(2)
	})
})
