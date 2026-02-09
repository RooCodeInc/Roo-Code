// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-images.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"
import { Task } from "../../task/Task"
import type { ImagePart } from "ai"

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
	isValidToolName: vi.fn((toolName: string) =>
		["read_file", "write_to_file", "ask_followup_question", "attempt_completion", "use_mcp_tool"].includes(
			toolName,
		),
	),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

describe("presentAssistantMessage - Image Handling in Native Tool Calling", () => {
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
			didCompleteReadingStream: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			consecutiveMistakeCount: 0,
			api: {
				getModel: () => ({ id: "test-model", info: {} }),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			recordToolUsage: vi.fn(),
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

		// Add pushToolResultToUserContent method after mockTask is created so it can reference mockTask
		mockTask.pushToolResultToUserContent = vi.fn().mockImplementation((toolResult: any) => {
			const existingResult = mockTask.userMessageContent.find(
				(block: any) => block.type === "tool-result" && block.toolCallId === toolResult.toolCallId,
			)
			if (existingResult) {
				return false
			}
			mockTask.userMessageContent.push(toolResult)
			return true
		})
	})

	it("should preserve images in tool_result for native tool calling", async () => {
		// Set up a tool_use block with an ID (indicates native tool calling)
		const toolCallId = "tool_call_123"
		mockTask.assistantMessageContent = [
			{
				type: "tool-call",
				toolCallId: toolCallId, // ID indicates native tool calling
				toolName: "ask_followup_question",
				input: { question: "What do you see?" },
				nativeArgs: { question: "What do you see?", follow_up: [] },
			},
		]

		// Create a mock askApproval that includes images in the response
		const imageBlock: ImagePart = {
			type: "image",
			image: "base64ImageData",
			mediaType: "image/png",
		}

		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
			text: "I see a cat",
			images: ["data:image/png;base64,base64ImageData"],
		})

		// Execute presentAssistantMessage
		await presentAssistantMessage(mockTask)

		// Verify that userMessageContent was populated
		expect(mockTask.userMessageContent.length).toBeGreaterThan(0)

		// Find the tool_result block
		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
		)

		expect(toolResult).toBeDefined()
		expect(toolResult.toolCallId).toBe(toolCallId)

		// For native tool calling, tool_result output should contain the text
		const outputValue = typeof toolResult.output === "string" ? toolResult.output : toolResult.output?.value
		expect(outputValue).toContain("I see a cat")

		// Images should be added as separate blocks AFTER the tool_result
		const imageBlocks = mockTask.userMessageContent.filter((item: any) => item.type === "image")
		expect(imageBlocks.length).toBeGreaterThan(0)
	})

	it("should convert to string when no images are present (native tool calling)", async () => {
		// Set up a tool_use block with an ID (indicates native protocol)
		const toolCallId = "tool_call_456"
		mockTask.assistantMessageContent = [
			{
				type: "tool-call",
				toolCallId: toolCallId,
				toolName: "ask_followup_question",
				input: { question: "What is your name?" },
				nativeArgs: { question: "What is your name?", follow_up: [] },
			},
		]

		// Response with text but NO images
		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
			text: "My name is Alice",
			images: undefined,
		})

		await presentAssistantMessage(mockTask)

		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
		)

		expect(toolResult).toBeDefined()

		// When no images, output should be defined
		expect(toolResult.output).toBeDefined()
	})

	it("should fail fast when tool_use is missing id (legacy/XML-style tool call)", async () => {
		// tool_use without an id is treated as legacy/XML-style tool call and must be rejected.
		mockTask.assistantMessageContent = [
			{
				type: "tool-call",
				toolName: "ask_followup_question",
				input: { question: "What do you see?" },
			},
		]

		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
			text: "I see a dog",
			images: ["data:image/png;base64,dogImageData"],
		})

		await presentAssistantMessage(mockTask)

		const textBlocks = mockTask.userMessageContent.filter((item: any) => item.type === "text")
		expect(textBlocks.length).toBeGreaterThan(0)
		expect(textBlocks.some((b: any) => String(b.text).includes("XML tool calls are no longer supported"))).toBe(
			true,
		)
		// Should not proceed to execute tool or add images as tool output.
		expect(mockTask.userMessageContent.some((item: any) => item.type === "image")).toBe(false)
	})

	it("should handle empty tool result gracefully", async () => {
		const toolCallId = "tool_call_789"
		mockTask.assistantMessageContent = [
			{
				type: "tool-call",
				toolCallId: toolCallId,
				toolName: "attempt_completion",
				input: { result: "Task completed" },
			},
		]

		// Empty response
		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
			text: undefined,
			images: undefined,
		})

		await presentAssistantMessage(mockTask)

		const toolResult = mockTask.userMessageContent.find(
			(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
		)

		expect(toolResult).toBeDefined()
		// Should have fallback output
		expect(toolResult.output).toBeDefined()
	})

	describe("Multiple tool calls handling", () => {
		it("should send tool_result with is_error for skipped tools in native tool calling when didRejectTool is true", async () => {
			// Simulate multiple tool calls with native protocol (all have IDs)
			const toolCallId1 = "tool_call_001"
			const toolCallId2 = "tool_call_002"

			mockTask.assistantMessageContent = [
				{
					type: "tool-call",
					toolCallId: toolCallId1,
					toolName: "read_file",
					input: { path: "test.txt" },
				},
				{
					type: "tool-call",
					toolCallId: toolCallId2,
					toolName: "write_to_file",
					input: { path: "output.txt", content: "test" },
				},
			]

			// First tool is rejected
			mockTask.didRejectTool = true

			// Process the second tool (should be skipped)
			mockTask.currentStreamingContentIndex = 1
			await presentAssistantMessage(mockTask)

			// Find the tool_result for the second tool
			const toolResult = mockTask.userMessageContent.find(
				(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId2,
			)

			// Verify that a tool_result block was created (not a text block)
			expect(toolResult).toBeDefined()
			expect(toolResult.toolCallId).toBe(toolCallId2)
			// Error is indicated by output type, not isError flag
			expect(toolResult.output).toBeDefined()
			const outputValue = typeof toolResult.output === "string" ? toolResult.output : toolResult.output?.value
			expect(outputValue).toContain("due to user rejecting a previous tool")

			// Ensure no text blocks were added for this rejection
			const textBlocks = mockTask.userMessageContent.filter(
				(item: any) => item.type === "text" && item.text.includes("due to user rejecting"),
			)
			expect(textBlocks.length).toBe(0)
		})

		it("should reject subsequent tool calls when a legacy/XML-style tool call is encountered", async () => {
			mockTask.assistantMessageContent = [
				{
					type: "tool-call",
					toolName: "read_file",
					input: { path: "test.txt" },
				},
				{
					type: "tool-call",
					toolName: "write_to_file",
					input: { path: "output.txt", content: "test" },
				},
			]

			// First tool is rejected
			mockTask.didRejectTool = true

			// Process the second tool (should be skipped)
			mockTask.currentStreamingContentIndex = 1
			await presentAssistantMessage(mockTask)

			const textBlocks = mockTask.userMessageContent.filter((item: any) => item.type === "text")
			expect(textBlocks.some((b: any) => String(b.text).includes("XML tool calls are no longer supported"))).toBe(
				true,
			)
			// Ensure no tool_result blocks were added
			expect(mockTask.userMessageContent.some((item: any) => item.type === "tool-result")).toBe(false)
		})

		it("should handle partial tool blocks when didRejectTool is true in native tool calling", async () => {
			const toolCallId = "tool_call_005"

			mockTask.assistantMessageContent = [
				{
					type: "tool-call",
					toolCallId: toolCallId,
					toolName: "write_to_file",
					input: { path: "output.txt", content: "test" },
					partial: true, // Partial tool block
				},
			]

			mockTask.didRejectTool = true

			await presentAssistantMessage(mockTask)

			// Find the tool_result
			const toolResult = mockTask.userMessageContent.find(
				(item: any) => item.type === "tool-result" && item.toolCallId === toolCallId,
			)

			// Verify tool_result was created for partial block
			expect(toolResult).toBeDefined()
			// Error is indicated by output type, not isError flag
			expect(toolResult.output).toBeDefined()
			const outputValue = typeof toolResult.output === "string" ? toolResult.output : toolResult.output?.value
			expect(outputValue).toContain("was interrupted and not executed")
		})
	})
})
