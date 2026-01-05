import { Anthropic } from "@anthropic-ai/sdk"
import { TelemetryService } from "@roo-code/telemetry"
import { getEffectiveApiHistory } from "../index"
import { ToolResultIdMismatchError } from "../../task/validateToolResultIds"
import type { ApiMessage } from "../../task-persistence"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn(() => true),
		instance: {
			captureException: vi.fn(),
		},
	},
}))

describe("getEffectiveApiHistory - tool_result validation", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("when history is too short", () => {
		it("should return unchanged history when empty", () => {
			const history: ApiMessage[] = []
			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})

		it("should return unchanged history with only one message", () => {
			const history: ApiMessage[] = [
				{
					role: "user",
					content: "Hello",
					ts: Date.now(),
				},
			]
			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("when there is no assistant message", () => {
		it("should return unchanged history", () => {
			const history: ApiMessage[] = [
				{
					role: "user",
					content: "First message",
					ts: Date.now(),
				},
				{
					role: "user",
					content: "Second message",
					ts: Date.now(),
				},
			]
			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("when assistant message is not followed by user message", () => {
		it("should return unchanged history", () => {
			const history: ApiMessage[] = [
				{
					role: "user",
					content: "User message",
					ts: Date.now(),
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-123",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
			]
			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("when tool_result IDs match tool_use IDs", () => {
		it("should return unchanged history for single tool", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-123",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "File content",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
			expect(TelemetryService.instance.captureException).not.toHaveBeenCalled()
		})

		it("should return unchanged history for multiple tools", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "read_file",
							input: { path: "a.txt" },
						},
						{
							type: "tool_use",
							id: "tool-2",
							name: "read_file",
							input: { path: "b.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-1",
							content: "Content A",
						},
						{
							type: "tool_result",
							tool_use_id: "tool-2",
							content: "Content B",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
			expect(TelemetryService.instance.captureException).not.toHaveBeenCalled()
		})
	})

	describe("when tool_result IDs do not match tool_use IDs", () => {
		it("should fix single mismatched tool_use_id by position", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "correct-id-123",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "wrong-id-456",
							content: "File content",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)

			expect(result).not.toEqual(history) // Should be modified
			expect(result.length).toBe(2)

			const userMessage = result[1]
			expect(Array.isArray(userMessage.content)).toBe(true)
			const userContent = userMessage.content as Anthropic.ToolResultBlockParam[]
			expect(userContent[0].tool_use_id).toBe("correct-id-123")
			expect(userContent[0].content).toBe("File content")

			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(ToolResultIdMismatchError),
				expect.objectContaining({
					toolResultIds: ["wrong-id-456"],
					toolUseIds: ["correct-id-123"],
					context: "getEffectiveApiHistory",
				}),
			)
		})

		it("should fix multiple mismatched tool_use_ids by position", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "correct-1",
							name: "read_file",
							input: { path: "a.txt" },
						},
						{
							type: "tool_use",
							id: "correct-2",
							name: "read_file",
							input: { path: "b.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "wrong-1",
							content: "Content A",
						},
						{
							type: "tool_result",
							tool_use_id: "wrong-2",
							content: "Content B",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)

			const userMessage = result[1]
			expect(Array.isArray(userMessage.content)).toBe(true)
			const userContent = userMessage.content as Anthropic.ToolResultBlockParam[]
			expect(userContent[0].tool_use_id).toBe("correct-1")
			expect(userContent[1].tool_use_id).toBe("correct-2")
		})

		it("should partially fix when some IDs match and some don't", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "id-1",
							name: "read_file",
							input: { path: "a.txt" },
						},
						{
							type: "tool_use",
							id: "id-2",
							name: "read_file",
							input: { path: "b.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "id-1", // Correct
							content: "Content A",
						},
						{
							type: "tool_result",
							tool_use_id: "wrong-id", // Wrong
							content: "Content B",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)

			const userMessage = result[1]
			expect(Array.isArray(userMessage.content)).toBe(true)
			const userContent = userMessage.content as Anthropic.ToolResultBlockParam[]
			expect(userContent[0].tool_use_id).toBe("id-1")
			expect(userContent[1].tool_use_id).toBe("id-2")
		})
	})

	describe("when there are orphaned tool_results", () => {
		it("should remove orphaned tool_results with invalid IDs", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "wrong-1",
							content: "Content 1",
						},
						{
							type: "tool_result",
							tool_use_id: "extra-id",
							content: "Content 2",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)

			const userMessage = result[1]
			expect(Array.isArray(userMessage.content)).toBe(true)
			const userContent = userMessage.content as Anthropic.ToolResultBlockParam[]
			// Only one tool_result should remain - the first one gets fixed to tool-1
			expect(userContent.length).toBe(1)
			expect(userContent[0].tool_use_id).toBe("tool-1")
		})

		it("should preserve text blocks while filtering orphaned tool_results", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-1",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "wrong-1",
							content: "Content 1",
						},
						{
							type: "text",
							text: "Some additional context",
						},
						{
							type: "tool_result",
							tool_use_id: "extra-id",
							content: "Content 2",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)

			const userMessage = result[1]
			expect(Array.isArray(userMessage.content)).toBe(true)
			const userContent = userMessage.content as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>
			// Should have tool_result + text block, orphaned tool_result filtered out
			expect(userContent.length).toBe(2)
			expect(userContent[0].type).toBe("tool_result")
			expect((userContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-1")
			expect(userContent[1].type).toBe("text")
			expect((userContent[1] as Anthropic.TextBlockParam).text).toBe("Some additional context")
		})
	})

	describe("when user message content is a string", () => {
		it("should return unchanged history", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-123",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: "Just a plain text message",
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("when assistant message content is a string", () => {
		it("should return unchanged history", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: "Just some text, no tool use",
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "Result",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("when assistant has no tool_use blocks", () => {
		it("should return unchanged history", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "Let me read that file for you.",
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool-123",
							content: "Result",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("when user message has no tool_results", () => {
		it("should return unchanged history", () => {
			const history: ApiMessage[] = [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool-123",
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Some user message without tool results",
						},
					],
					ts: Date.now(),
				},
			]

			const result = getEffectiveApiHistory(history)
			expect(result).toEqual(history)
		})
	})

	describe("condensation scenario with tool_result ID mismatch", () => {
		it("should fix tool_result IDs after condensation removed the original assistant message", () => {
			// Simulate the bug scenario:
			// 1. Original assistant message (ID: old-id) was condensed away (has condenseParent tag)
			// 2. New assistant message (ID: new-id) is in the effective history
			// 3. User message still references the old condensed ID

			const condenseId = "summary-123"
			const history: ApiMessage[] = [
				// Earlier conversation
				{
					role: "user",
					content: "Earlier conversation",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "Earlier response",
					ts: Date.now() - 9000,
				},
				// OLD assistant message that will be FILTERED OUT (has condenseParent)
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_vrtx_017zoz78rZkfhPsVf1SJkx1k", // OLD ID (will be filtered)
							name: "read_file",
							input: { path: "old.txt" },
						},
					],
					ts: Date.now() - 5000,
					condenseParent: condenseId, // This tags it for filtering
				},
				// Summary that replaces the condensed messages
				{
					role: "assistant",
					content: "Summary of earlier work",
					ts: Date.now() - 1000,
					isSummary: true,
					condenseId,
				},
				// NEW assistant message with NEW tool_use ID (after condensation)
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "toolu_vrtx_01LgtuK736Gh2vTuRX8aUaRf", // NEW ID (in effective history)
							name: "read_file",
							input: { path: "test.txt" },
						},
					],
					ts: Date.now(),
				},
				// User message still referencing OLD condensed ID
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "toolu_vrtx_017zoz78rZkfhPsVf1SJkx1k", // OLD ID from condensed message
							content: "File content",
						},
					],
					ts: Date.now() + 1000,
				},
			]

			const result = getEffectiveApiHistory(history)

			// Verify the condensed assistant message was filtered out
			const assistantMessages = result.filter((m) => m.role === "assistant")
			expect(assistantMessages.some((m) => m.condenseParent === condenseId)).toBe(false)

			// Verify the tool_result ID was fixed to match the NEW assistant message
			const lastUserMessage = result[result.length - 1]
			expect(Array.isArray(lastUserMessage.content)).toBe(true)
			const userContent = lastUserMessage.content as Anthropic.ToolResultBlockParam[]
			expect(userContent[0].tool_use_id).toBe("toolu_vrtx_01LgtuK736Gh2vTuRX8aUaRf")
			expect(userContent[0].content).toBe("File content")

			// Verify telemetry was captured
			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(ToolResultIdMismatchError),
				expect.objectContaining({
					context: "getEffectiveApiHistory",
				}),
			)
		})

		it("should handle complex condensation with multiple tools", () => {
			const condenseId = "summary-456"
			const history: ApiMessage[] = [
				// Previous condensed conversation
				{
					role: "user",
					content: "Earlier work",
					ts: Date.now() - 10000,
				},
				{
					role: "assistant",
					content: "Earlier response",
					ts: Date.now() - 9000,
				},
				// OLD assistant message with OLD tool IDs (will be filtered)
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "old-condensed-id-1",
							name: "read_file",
							input: { path: "old1.txt" },
						},
						{
							type: "tool_use",
							id: "old-condensed-id-2",
							name: "read_file",
							input: { path: "old2.txt" },
						},
					],
					ts: Date.now() - 5000,
					condenseParent: condenseId,
				},
				// Summary
				{
					role: "assistant",
					content: "Summary of previous work",
					ts: Date.now() - 1000,
					isSummary: true,
					condenseId,
				},
				// Current assistant message after condensation with NEW tool IDs
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "I'll help you with those files.",
						},
						{
							type: "tool_use",
							id: "current-id-1",
							name: "read_file",
							input: { path: "file1.txt" },
						},
						{
							type: "tool_use",
							id: "current-id-2",
							name: "read_file",
							input: { path: "file2.txt" },
						},
					],
					ts: Date.now(),
				},
				// User message with OLD IDs from condensed away messages
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "old-condensed-id-1",
							content: "File 1 content",
						},
						{
							type: "tool_result",
							tool_use_id: "old-condensed-id-2",
							content: "File 2 content",
						},
						{
							type: "text",
							text: "Environment details here",
						},
					],
					ts: Date.now() + 1000,
				},
			]

			const result = getEffectiveApiHistory(history)

			// Verify both tool_result IDs were fixed
			const lastUserMessage = result[result.length - 1]
			expect(Array.isArray(lastUserMessage.content)).toBe(true)
			const userContent = lastUserMessage.content as Array<
				Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam
			>

			expect(userContent.length).toBe(3)
			expect(userContent[0].type).toBe("tool_result")
			expect((userContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("current-id-1")
			expect(userContent[1].type).toBe("tool_result")
			expect((userContent[1] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("current-id-2")
			expect(userContent[2].type).toBe("text")
		})

		it("should handle condensation filtering and tool_result validation together", () => {
			const condenseId = "summary-789"
			const history: ApiMessage[] = [
				// Message that will be condensed
				{
					role: "user",
					content: "Old request",
					ts: 100,
					condenseParent: condenseId,
				},
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "old-tool-id",
							name: "execute_command",
							input: { command: "ls" },
						},
					],
					ts: 200,
					condenseParent: condenseId,
				},
				// Summary replaces condensed messages
				{
					role: "assistant",
					content: "Summary: Executed command",
					ts: 299,
					isSummary: true,
					condenseId,
				},
				// New assistant with NEW tool_use
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "new-tool-id",
							name: "read_file",
							input: { path: "config.json" },
						},
					],
					ts: 300,
				},
				// User message referencing the OLD (now filtered) tool_use ID
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "old-tool-id", // References filtered message
							content: "Config content",
						},
					],
					ts: 400,
				},
			]

			const result = getEffectiveApiHistory(history)

			// Verify condensed messages were filtered
			expect(result.some((m) => m.condenseParent === condenseId)).toBe(false)

			// Verify summary is present
			expect(result.some((m) => m.isSummary && m.condenseId === condenseId)).toBe(true)

			// Verify tool_result ID was corrected to match NEW tool_use
			const lastUserMessage = result[result.length - 1]
			const userContent = lastUserMessage.content as Anthropic.ToolResultBlockParam[]
			expect(userContent[0].tool_use_id).toBe("new-tool-id")
		})
	})
})
