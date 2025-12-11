import { Anthropic } from "@anthropic-ai/sdk"
import { TelemetryService } from "@roo-code/telemetry"
import {
	validateAndFixToolResultIds,
	ToolResultIdMismatchError,
	MissingToolResultError,
} from "../validateToolResultIds"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn(() => true),
		instance: {
			captureException: vi.fn(),
		},
	},
}))

describe("validateAndFixToolResultIds", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("when there is no previous assistant message", () => {
		it("should return the user message unchanged", () => {
			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Result",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when tool_result IDs match tool_use IDs", () => {
		it("should return the user message unchanged for single tool", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "File content",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})

		it("should return the user message unchanged for multiple tools", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
			}

			const userMessage: Anthropic.MessageParam = {
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
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when tool_result IDs do not match tool_use IDs", () => {
		it("should fix single mismatched tool_use_id by position", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "correct-id-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "wrong-id-456",
						content: "File content",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent[0].tool_use_id).toBe("correct-id-123")
			expect(resultContent[0].content).toBe("File content")
		})

		it("should fix multiple mismatched tool_use_ids by position", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
			}

			const userMessage: Anthropic.MessageParam = {
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
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent[0].tool_use_id).toBe("correct-1")
			expect(resultContent[1].tool_use_id).toBe("correct-2")
		})

		it("should partially fix when some IDs match and some don't", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
			}

			const userMessage: Anthropic.MessageParam = {
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
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent[0].tool_use_id).toBe("id-1")
			expect(resultContent[1].tool_use_id).toBe("id-2")
		})
	})

	describe("when user message has non-tool_result content", () => {
		it("should preserve text blocks alongside tool_result blocks", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "wrong-id",
						content: "File content",
					},
					{
						type: "text",
						text: "Additional context",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>
			expect(resultContent[0].type).toBe("tool_result")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-123")
			expect(resultContent[1].type).toBe("text")
			expect((resultContent[1] as Anthropic.TextBlockParam).text).toBe("Additional context")
		})
	})

	describe("when assistant message has non-tool_use content", () => {
		it("should only consider tool_use blocks for matching", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Let me read that file for you.",
					},
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "wrong-id",
						content: "File content",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent[0].tool_use_id).toBe("tool-123")
		})
	})

	describe("when user message content is a string", () => {
		it("should return the message unchanged", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: "Just a plain text message",
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when assistant message content is a string", () => {
		it("should return the user message unchanged", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: "Just some text, no tool use",
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Result",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when there are more tool_results than tool_uses", () => {
		it("should leave extra tool_results unchanged", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-1",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
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
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent[0].tool_use_id).toBe("tool-1")
			// Extra tool_result should remain unchanged
			expect(resultContent[1].tool_use_id).toBe("extra-id")
		})
	})

	describe("when there are more tool_uses than tool_results", () => {
		it("should fix the available tool_results and add missing ones", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "wrong-1",
						content: "Content 1",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			// Should now have 2 tool_results: one fixed and one added for the missing tool_use
			expect(resultContent.length).toBe(2)
			// The missing tool_result is prepended
			expect(resultContent[0].tool_use_id).toBe("tool-2")
			expect(resultContent[0].content).toBe("Tool execution was interrupted before completion.")
			// The original is fixed
			expect(resultContent[1].tool_use_id).toBe("tool-1")
		})
	})

	describe("when tool_results are completely missing", () => {
		it("should add missing tool_result for single tool_use", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "text",
						text: "Some user message without tool results",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>
			expect(resultContent.length).toBe(2)
			// Missing tool_result should be prepended
			expect(resultContent[0].type).toBe("tool_result")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-123")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).content).toBe(
				"Tool execution was interrupted before completion.",
			)
			// Original text block should be preserved
			expect(resultContent[1].type).toBe("text")
		})

		it("should add missing tool_results for multiple tool_uses", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
						name: "write_to_file",
						input: { path: "b.txt", content: "test" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "text",
						text: "User message",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>
			expect(resultContent.length).toBe(3)
			// Both missing tool_results should be prepended
			expect(resultContent[0].type).toBe("tool_result")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-1")
			expect(resultContent[1].type).toBe("tool_result")
			expect((resultContent[1] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-2")
			// Original text should be preserved
			expect(resultContent[2].type).toBe("text")
		})

		it("should add only the missing tool_results when some exist", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
						name: "write_to_file",
						input: { path: "b.txt", content: "test" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-1",
						content: "Content for tool 1",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent.length).toBe(2)
			// Missing tool_result for tool-2 should be prepended
			expect(resultContent[0].tool_use_id).toBe("tool-2")
			expect(resultContent[0].content).toBe("Tool execution was interrupted before completion.")
			// Existing tool_result should be preserved
			expect(resultContent[1].tool_use_id).toBe("tool-1")
			expect(resultContent[1].content).toBe("Content for tool 1")
		})

		it("should handle empty user content array by adding all missing tool_results", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-1",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].type).toBe("tool_result")
			expect(resultContent[0].tool_use_id).toBe("tool-1")
			expect(resultContent[0].content).toBe("Tool execution was interrupted before completion.")
		})
	})

	describe("telemetry", () => {
		it("should call captureException for both missing and mismatch when there is a mismatch", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "correct-id",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "wrong-id",
						content: "Content",
					},
				],
			}

			validateAndFixToolResultIds(userMessage, [assistantMessage])

			// A mismatch also triggers missing detection since the wrong-id doesn't match any tool_use
			expect(TelemetryService.instance.captureException).toHaveBeenCalledTimes(2)
			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(MissingToolResultError),
				expect.objectContaining({
					missingToolUseIds: ["correct-id"],
					existingToolResultIds: ["wrong-id"],
					toolUseCount: 1,
					toolResultCount: 1,
				}),
			)
			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(ToolResultIdMismatchError),
				expect.objectContaining({
					toolResultIds: ["wrong-id"],
					toolUseIds: ["correct-id"],
					toolResultCount: 1,
					toolUseCount: 1,
				}),
			)
		})

		it("should not call captureException when IDs match", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Content",
					},
				],
			}

			validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(TelemetryService.instance.captureException).not.toHaveBeenCalled()
		})
	})

	describe("ToolResultIdMismatchError", () => {
		it("should create error with correct properties", () => {
			const error = new ToolResultIdMismatchError(
				"Mismatch detected",
				["result-1", "result-2"],
				["use-1", "use-2"],
			)

			expect(error.name).toBe("ToolResultIdMismatchError")
			expect(error.message).toBe("Mismatch detected")
			expect(error.toolResultIds).toEqual(["result-1", "result-2"])
			expect(error.toolUseIds).toEqual(["use-1", "use-2"])
		})
	})

	describe("MissingToolResultError", () => {
		it("should create error with correct properties", () => {
			const error = new MissingToolResultError(
				"Missing tool results detected",
				["tool-1", "tool-2"],
				["existing-result-1"],
			)

			expect(error.name).toBe("MissingToolResultError")
			expect(error.message).toBe("Missing tool results detected")
			expect(error.missingToolUseIds).toEqual(["tool-1", "tool-2"])
			expect(error.existingToolResultIds).toEqual(["existing-result-1"])
		})
	})

	describe("telemetry for missing tool_results", () => {
		it("should call captureException when tool_results are missing", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "text",
						text: "No tool results here",
					},
				],
			}

			validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(TelemetryService.instance.captureException).toHaveBeenCalledTimes(1)
			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(MissingToolResultError),
				expect.objectContaining({
					missingToolUseIds: ["tool-123"],
					existingToolResultIds: [],
					toolUseCount: 1,
					toolResultCount: 0,
				}),
			)
		})

		it("should call captureException twice when both mismatch and missing occur", () => {
			const assistantMessage: Anthropic.MessageParam = {
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
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "wrong-id", // Wrong ID (mismatch)
						content: "Content",
					},
					// Missing tool_result for tool-2
				],
			}

			validateAndFixToolResultIds(userMessage, [assistantMessage])

			// Should be called twice: once for missing, once for mismatch
			expect(TelemetryService.instance.captureException).toHaveBeenCalledTimes(2)
			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(MissingToolResultError),
				expect.any(Object),
			)
			expect(TelemetryService.instance.captureException).toHaveBeenCalledWith(
				expect.any(ToolResultIdMismatchError),
				expect.any(Object),
			)
		})

		it("should not call captureException for missing when all tool_results exist", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tool-123",
						name: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tool-123",
						content: "Content",
					},
				],
			}

			validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(TelemetryService.instance.captureException).not.toHaveBeenCalled()
		})
	})
})
