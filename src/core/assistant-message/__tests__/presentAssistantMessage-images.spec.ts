// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage-images.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"
import { presentAssistantMessage } from "../presentAssistantMessage"
import { Task } from "../../task/Task"
import { TOOL_PROTOCOL } from "@roo-code/types"

// Mock dependencies
vi.mock("../../task/Task")
vi.mock("../../tools/validateToolUse", () => ({
	validateToolUse: vi.fn(),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

describe("presentAssistantMessage - Image Handling in Native Tool Calls", () => {
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
			diffEnabled: false,
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
	})

	it("should preserve images in tool_result for native protocol", async () => {
		// Set up a tool_use block with an ID (indicates native protocol)
		const toolCallId = "tool_call_123"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId, // ID indicates native protocol
				name: "ask_followup_question",
				params: { question: "What do you see?" },
			},
		]

		// Create a mock askApproval that includes images in the response
		const imageBlock: Anthropic.ImageBlockParam = {
			type: "image",
			source: {
				type: "base64",
				media_type: "image/png",
				data: "base64ImageData",
			},
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
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)

		expect(toolResult).toBeDefined()
		expect(toolResult.tool_use_id).toBe(toolCallId)

		// For native protocol, tool_result content should be a string (text only)
		expect(typeof toolResult.content).toBe("string")
		expect(toolResult.content).toContain("I see a cat")

		// Images should be added as separate blocks AFTER the tool_result
		const imageBlocks = mockTask.userMessageContent.filter((item: any) => item.type === "image")
		expect(imageBlocks.length).toBeGreaterThan(0)
		expect(imageBlocks[0].source.data).toBe("base64ImageData")
	})

	it("should convert to string when no images are present (native protocol)", async () => {
		// Set up a tool_use block with an ID (indicates native protocol)
		const toolCallId = "tool_call_456"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "ask_followup_question",
				params: { question: "What is your name?" },
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
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)

		expect(toolResult).toBeDefined()

		// When no images, content should be a string
		expect(typeof toolResult.content).toBe("string")
	})

	it("should preserve images in content array for XML protocol (existing behavior)", async () => {
		// Set up a tool_use block WITHOUT an ID (indicates XML protocol)
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				// No ID = XML protocol
				name: "ask_followup_question",
				params: { question: "What do you see?" },
			},
		]

		mockTask.ask = vi.fn().mockResolvedValue({
			response: "yesButtonClicked",
			text: "I see a dog",
			images: ["data:image/png;base64,dogImageData"],
		})

		await presentAssistantMessage(mockTask)

		// For XML protocol, content is added as separate blocks
		// Check that both text and image blocks were added
		const hasTextBlock = mockTask.userMessageContent.some((item: any) => item.type === "text")
		const hasImageBlock = mockTask.userMessageContent.some((item: any) => item.type === "image")

		expect(hasTextBlock).toBe(true)
		// XML protocol preserves images as separate blocks in userMessageContent
		expect(hasImageBlock).toBe(true)
	})

	it("should handle empty tool result gracefully", async () => {
		const toolCallId = "tool_call_789"
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				id: toolCallId,
				name: "attempt_completion",
				params: { result: "Task completed" },
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
			(item: any) => item.type === "tool_result" && item.tool_use_id === toolCallId,
		)

		expect(toolResult).toBeDefined()
		// Should have fallback text
		expect(toolResult.content).toBeTruthy()
	})
})
