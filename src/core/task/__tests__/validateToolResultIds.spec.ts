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
		it("should filter out orphaned tool_results with invalid IDs", () => {
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
			// Only one tool_result should remain - the first one gets fixed to tool-1
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].tool_use_id).toBe("tool-1")
		})

		it("should filter out duplicate tool_results when one already has a valid ID", () => {
			// This is the exact scenario from the PostHog error:
			// 2 tool_results (call_08230257, call_55577629), 1 tool_use (call_55577629)
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "call_55577629",
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
						tool_use_id: "call_08230257", // Invalid ID
						content: "Content from first result",
					},
					{
						type: "tool_result",
						tool_use_id: "call_55577629", // Valid ID
						content: "Content from second result",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]
			// Should only keep one tool_result since there's only one tool_use
			// The first invalid one gets fixed to the valid ID, then the second one
			// (which already has that ID) becomes a duplicate and is filtered out
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].tool_use_id).toBe("call_55577629")
		})

		it("should preserve text blocks while filtering orphaned tool_results", () => {
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
						type: "text",
						text: "Some additional context",
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
			const resultContent = result.content as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>
			// Should have tool_result + text block, orphaned tool_result filtered out
			expect(resultContent.length).toBe(2)
			expect(resultContent[0].type).toBe("tool_result")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-1")
			expect(resultContent[1].type).toBe("text")
			expect((resultContent[1] as Anthropic.TextBlockParam).text).toBe("Some additional context")
		})

		// Verifies fix for GitHub #10465: Terminal fallback race condition can generate
		// duplicate tool_results with the same valid tool_use_id, causing API protocol violations.
		it("should filter out duplicate tool_results with identical valid tool_use_ids (terminal fallback scenario)", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool_use",
						id: "tooluse_QZ-pU8v2QKO8L8fHoJRI2g",
						name: "execute_command",
						input: { command: "ps aux | grep test", cwd: "/path/to/project" },
					},
				],
			}

			// Two tool_results with the SAME valid tool_use_id from terminal fallback race condition
			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "tooluse_QZ-pU8v2QKO8L8fHoJRI2g", // First result from command execution
						content: "No test processes found",
					},
					{
						type: "tool_result",
						tool_use_id: "tooluse_QZ-pU8v2QKO8L8fHoJRI2g", // Duplicate from user approval during fallback
						content: '{"status":"approved","message":"The user approved this operation"}',
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Anthropic.ToolResultBlockParam[]

			// Only ONE tool_result should remain to prevent API protocol violation
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].tool_use_id).toBe("tooluse_QZ-pU8v2QKO8L8fHoJRI2g")
			expect(resultContent[0].content).toBe("No test processes found")
		})

		it("should preserve text blocks while deduplicating tool_results with same valid ID", () => {
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
						content: "First result",
					},
					{
						type: "text",
						text: "Environment details here",
					},
					{
						type: "tool_result",
						tool_use_id: "tool-123", // Duplicate with same valid ID
						content: "Duplicate result from fallback",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam>

			// Should have: 1 tool_result + 1 text block (duplicate filtered out)
			expect(resultContent.length).toBe(2)
			expect(resultContent[0].type).toBe("tool_result")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).tool_use_id).toBe("tool-123")
			expect((resultContent[0] as Anthropic.ToolResultBlockParam).content).toBe("First result")
			expect(resultContent[1].type).toBe("text")
			expect((resultContent[1] as Anthropic.TextBlockParam).text).toBe("Environment details here")
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
			// Reordered to match tool_use order: tool-1 first (fixed from wrong-1), tool-2 second (injected)
			expect(resultContent[0].tool_use_id).toBe("tool-1")
			expect(resultContent[1].tool_use_id).toBe("tool-2")
			expect(resultContent[1].content).toBe("Tool execution was interrupted before completion.")
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
			// Reordered to match tool_use order: tool-1 first (existing), tool-2 second (injected)
			expect(resultContent[0].tool_use_id).toBe("tool-1")
			expect(resultContent[0].content).toBe("Content for tool 1")
			expect(resultContent[1].tool_use_id).toBe("tool-2")
			expect(resultContent[1].content).toBe("Tool execution was interrupted before completion.")
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

	describe("tool_result reordering to match tool_use order", () => {
		it("should reorder out-of-order tool_results to match tool_use order", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool-A", name: "read_file", input: { path: "a.txt" } },
					{ type: "tool_use", id: "tool-B", name: "read_file", input: { path: "b.txt" } },
					{ type: "tool_use", id: "tool-C", name: "read_file", input: { path: "c.txt" } },
				],
			}

			// tool_results arrive in reverse order (C, B, A) instead of (A, B, C)
			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tool-C", content: "Result C" },
					{ type: "tool_result", tool_use_id: "tool-B", content: "Result B" },
					{ type: "tool_result", tool_use_id: "tool-A", content: "Result A" },
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])
			const content = result.content as Anthropic.ToolResultBlockParam[]

			expect(content[0].tool_use_id).toBe("tool-A")
			expect(content[1].tool_use_id).toBe("tool-B")
			expect(content[2].tool_use_id).toBe("tool-C")
		})

		it("should keep non-tool-result blocks in their original positions when reordering", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool-1", name: "read_file", input: { path: "a.txt" } },
					{ type: "tool_use", id: "tool-2", name: "write_file", input: { path: "b.txt" } },
				],
			}

			// tool_results are reversed, with a text block in between
			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tool-2", content: "Result 2" },
					{ type: "text", text: "Here are the results" },
					{ type: "tool_result", tool_use_id: "tool-1", content: "Result 1" },
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])
			const content = result.content as Anthropic.Messages.ContentBlockParam[]

			// tool_results should be reordered, but text block stays at index 1
			expect(content[0]).toEqual({ type: "tool_result", tool_use_id: "tool-1", content: "Result 1" })
			expect(content[1]).toEqual({ type: "text", text: "Here are the results" })
			expect(content[2]).toEqual({ type: "tool_result", tool_use_id: "tool-2", content: "Result 2" })
		})

		it("should not modify content when tool_results are already in correct order", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool-X", name: "read_file", input: { path: "x.txt" } },
					{ type: "tool_use", id: "tool-Y", name: "read_file", input: { path: "y.txt" } },
				],
			}

			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tool-X", content: "Result X" },
					{ type: "tool_result", tool_use_id: "tool-Y", content: "Result Y" },
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})

		it("should reorder tool_results even when mixed with missing result injection", () => {
			const assistantMessage: Anthropic.MessageParam = {
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool-1", name: "read_file", input: { path: "a.txt" } },
					{ type: "tool_use", id: "tool-2", name: "write_file", input: { path: "b.txt" } },
					{ type: "tool_use", id: "tool-3", name: "list_files", input: { path: "." } },
				],
			}

			// Only tool-3 and tool-1 have results (out of order), tool-2 is missing
			const userMessage: Anthropic.MessageParam = {
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tool-3", content: "Result 3" },
					{ type: "tool_result", tool_use_id: "tool-1", content: "Result 1" },
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])
			const toolResults = (result.content as Anthropic.Messages.ContentBlockParam[]).filter(
				(b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result",
			)

			// Should have 3 tool_results (including injected one for tool-2)
			expect(toolResults).toHaveLength(3)
			// They should be in tool_use order: tool-1, tool-2, tool-3
			expect(toolResults[0].tool_use_id).toBe("tool-1")
			expect(toolResults[1].tool_use_id).toBe("tool-2")
			expect(toolResults[2].tool_use_id).toBe("tool-3")
		})
	})
})
