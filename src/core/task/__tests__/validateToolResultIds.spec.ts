import type { TextPart, ToolResultPart } from "ai"
import type { RooMessageParam } from "../../task-persistence/apiMessages"
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
			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-123",
						toolName: "",
						output: { type: "text" as const, value: "Result" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when tool_result IDs match tool_use IDs", () => {
		it("should return the user message unchanged for single tool", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-123",
						toolName: "",
						output: { type: "text" as const, value: "File content" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})

		it("should return the user message unchanged for multiple tools", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "read_file",
						input: { path: "b.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-1",
						toolName: "",
						output: { type: "text" as const, value: "Content A" },
					},
					{
						type: "tool-result",
						toolCallId: "tool-2",
						toolName: "",
						output: { type: "text" as const, value: "Content B" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when tool_result IDs do not match tool_use IDs", () => {
		it("should fix single mismatched tool_use_id by position", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "correct-id-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-id-456",
						toolName: "",
						output: { type: "text" as const, value: "File content" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			expect(resultContent[0].toolCallId).toBe("correct-id-123")
			expect((resultContent[0].output as { value: string }).value).toBe("File content")
		})

		it("should fix multiple mismatched tool_use_ids by position", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "correct-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "correct-2",
						toolName: "read_file",
						input: { path: "b.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-1",
						toolName: "",
						output: { type: "text" as const, value: "Content A" },
					},
					{
						type: "tool-result",
						toolCallId: "wrong-2",
						toolName: "",
						output: { type: "text" as const, value: "Content B" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			expect(resultContent[0].toolCallId).toBe("correct-1")
			expect(resultContent[1].toolCallId).toBe("correct-2")
		})

		it("should partially fix when some IDs match and some don't", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "id-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "id-2",
						toolName: "read_file",
						input: { path: "b.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "id-1", // Correct
						toolName: "",
						output: { type: "text" as const, value: "Content A" },
					},
					{
						type: "tool-result",
						toolCallId: "wrong-id", // Wrong
						toolName: "",
						output: { type: "text" as const, value: "Content B" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			expect(resultContent[0].toolCallId).toBe("id-1")
			expect(resultContent[1].toolCallId).toBe("id-2")
		})
	})

	describe("when user message has non-tool_result content", () => {
		it("should preserve text blocks alongside tool_result blocks", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-id",
						toolName: "",
						output: { type: "text" as const, value: "File content" },
					},
					{
						type: "text",
						text: "Additional context",
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<ToolResultPart | TextPart>
			expect(resultContent[0].type).toBe("tool-result")
			expect((resultContent[0] as ToolResultPart).toolCallId).toBe("tool-123")
			expect(resultContent[1].type).toBe("text")
			expect((resultContent[1] as TextPart).text).toBe("Additional context")
		})
	})

	describe("when assistant message has non-tool_use content", () => {
		it("should only consider tool_use blocks for matching", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Let me read that file for you.",
					},
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-id",
						toolName: "",
						output: { type: "text" as const, value: "File content" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			expect(resultContent[0].toolCallId).toBe("tool-123")
		})
	})

	describe("when user message content is a string", () => {
		it("should return the message unchanged", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: "Just a plain text message",
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when assistant message content is a string", () => {
		it("should return the user message unchanged", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: "Just some text, no tool use",
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-123",
						toolName: "",
						output: { type: "text" as const, value: "Result" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(result).toEqual(userMessage)
		})
	})

	describe("when there are more tool_results than tool_uses", () => {
		it("should filter out orphaned tool_results with invalid IDs", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-1",
						toolName: "",
						output: { type: "text" as const, value: "Content 1" },
					},
					{
						type: "tool-result",
						toolCallId: "extra-id",
						toolName: "",
						output: { type: "text" as const, value: "Content 2" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			// Only one tool_result should remain - the first one gets fixed to tool-1
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].toolCallId).toBe("tool-1")
		})

		it("should filter out duplicate tool_results when one already has a valid ID", () => {
			// This is the exact scenario from the PostHog error:
			// 2 tool_results (call_08230257, call_55577629), 1 tool_use (call_55577629)
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "call_55577629",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "call_08230257", // Invalid ID
						toolName: "",
						output: { type: "text" as const, value: "Content from first result" },
					},
					{
						type: "tool-result",
						toolCallId: "call_55577629", // Valid ID
						toolName: "",
						output: { type: "text" as const, value: "Content from second result" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			// Should only keep one tool_result since there's only one tool_use
			// The first invalid one gets fixed to the valid ID, then the second one
			// (which already has that ID) becomes a duplicate and is filtered out
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].toolCallId).toBe("call_55577629")
		})

		it("should preserve text blocks while filtering orphaned tool_results", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-1",
						toolName: "",
						output: { type: "text" as const, value: "Content 1" },
					},
					{
						type: "text",
						text: "Some additional context",
					},
					{
						type: "tool-result",
						toolCallId: "extra-id",
						toolName: "",
						output: { type: "text" as const, value: "Content 2" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<ToolResultPart | TextPart>
			// Should have tool_result + text block, orphaned tool_result filtered out
			expect(resultContent.length).toBe(2)
			expect(resultContent[0].type).toBe("tool-result")
			expect((resultContent[0] as ToolResultPart).toolCallId).toBe("tool-1")
			expect(resultContent[1].type).toBe("text")
			expect((resultContent[1] as TextPart).text).toBe("Some additional context")
		})

		// Verifies fix for GitHub #10465: Terminal fallback race condition can generate
		// duplicate tool_results with the same valid tool_use_id, causing API protocol violations.
		it("should filter out duplicate tool_results with identical valid tool_use_ids (terminal fallback scenario)", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tooluse_QZ-pU8v2QKO8L8fHoJRI2g",
						toolName: "execute_command",
						input: { command: "ps aux | grep test", cwd: "/path/to/project" },
					},
				],
			}

			// Two tool_results with the SAME valid tool_use_id from terminal fallback race condition
			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tooluse_QZ-pU8v2QKO8L8fHoJRI2g", // First result from command execution
						toolName: "",
						output: { type: "text" as const, value: "No test processes found" },
					},
					{
						type: "tool-result",
						toolCallId: "tooluse_QZ-pU8v2QKO8L8fHoJRI2g", // Duplicate from user approval during fallback
						toolName: "",
						output: {
							type: "text" as const,
							value: '{"status":"approved","message":"The user approved this operation"}',
						},
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]

			// Only ONE tool_result should remain to prevent API protocol violation
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].toolCallId).toBe("tooluse_QZ-pU8v2QKO8L8fHoJRI2g")
			expect((resultContent[0].output as { value: string }).value).toBe("No test processes found")
		})

		it("should preserve text blocks while deduplicating tool_results with same valid ID", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-123",
						toolName: "",
						output: { type: "text" as const, value: "First result" },
					},
					{
						type: "text",
						text: "Environment details here",
					},
					{
						type: "tool-result",
						toolCallId: "tool-123", // Duplicate with same valid ID
						toolName: "",
						output: { type: "text" as const, value: "Duplicate result from fallback" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as Array<ToolResultPart | TextPart>

			// Should have: 1 tool_result + 1 text block (duplicate filtered out)
			expect(resultContent.length).toBe(2)
			expect(resultContent[0].type).toBe("tool-result")
			expect((resultContent[0] as ToolResultPart).toolCallId).toBe("tool-123")
			expect((resultContent[0] as ToolResultPart).output).toEqual({ type: "text", value: "First result" })
			expect(resultContent[1].type).toBe("text")
			expect((resultContent[1] as TextPart).text).toBe("Environment details here")
		})
	})

	describe("when there are more tool_uses than tool_results", () => {
		it("should fix the available tool_results and add missing ones", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "read_file",
						input: { path: "b.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-1",
						toolName: "",
						output: { type: "text" as const, value: "Content 1" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			// Should now have 2 tool_results: one fixed and one added for the missing tool_use
			expect(resultContent.length).toBe(2)
			// The missing tool_result is prepended
			expect(resultContent[0].toolCallId).toBe("tool-2")
			expect((resultContent[0].output as { value: string }).value).toBe(
				"Tool execution was interrupted before completion.",
			)
			// The original is fixed
			expect(resultContent[1].toolCallId).toBe("tool-1")
		})
	})

	describe("when tool_results are completely missing", () => {
		it("should add missing tool_result for single tool_use", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
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
			const resultContent = result.content as Array<ToolResultPart | TextPart>
			expect(resultContent.length).toBe(2)
			// Missing tool_result should be prepended
			expect(resultContent[0].type).toBe("tool-result")
			expect((resultContent[0] as ToolResultPart).toolCallId).toBe("tool-123")
			expect((resultContent[0] as ToolResultPart).output).toEqual({
				type: "text",
				value: "Tool execution was interrupted before completion.",
			})
			// Original text block should be preserved
			expect(resultContent[1].type).toBe("text")
		})

		it("should add missing tool_results for multiple tool_uses", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "write_to_file",
						input: { path: "b.txt", content: "test" },
					},
				],
			}

			const userMessage: RooMessageParam = {
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
			const resultContent = result.content as Array<ToolResultPart | TextPart>
			expect(resultContent.length).toBe(3)
			// Both missing tool_results should be prepended
			expect(resultContent[0].type).toBe("tool-result")
			expect((resultContent[0] as ToolResultPart).toolCallId).toBe("tool-1")
			expect(resultContent[1].type).toBe("tool-result")
			expect((resultContent[1] as ToolResultPart).toolCallId).toBe("tool-2")
			// Original text should be preserved
			expect(resultContent[2].type).toBe("text")
		})

		it("should add only the missing tool_results when some exist", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "write_to_file",
						input: { path: "b.txt", content: "test" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-1",
						toolName: "",
						output: { type: "text" as const, value: "Content for tool 1" },
					},
				],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			expect(resultContent.length).toBe(2)
			// Missing tool_result for tool-2 should be prepended
			expect(resultContent[0].toolCallId).toBe("tool-2")
			expect((resultContent[0].output as { value: string }).value).toBe(
				"Tool execution was interrupted before completion.",
			)
			// Existing tool_result should be preserved
			expect(resultContent[1].toolCallId).toBe("tool-1")
			expect((resultContent[1].output as { value: string }).value).toBe("Content for tool 1")
		})

		it("should handle empty user content array by adding all missing tool_results", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [],
			}

			const result = validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(Array.isArray(result.content)).toBe(true)
			const resultContent = result.content as ToolResultPart[]
			expect(resultContent.length).toBe(1)
			expect(resultContent[0].type).toBe("tool-result")
			expect(resultContent[0].toolCallId).toBe("tool-1")
			expect((resultContent[0].output as { value: string }).value).toBe(
				"Tool execution was interrupted before completion.",
			)
		})
	})

	describe("telemetry", () => {
		it("should call captureException for both missing and mismatch when there is a mismatch", () => {
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "correct-id",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-id",
						toolName: "",
						output: { type: "text" as const, value: "Content" },
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
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-123",
						toolName: "",
						output: { type: "text" as const, value: "Content" },
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
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
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
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "read_file",
						input: { path: "a.txt" },
					},
					{
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "read_file",
						input: { path: "b.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "wrong-id", // Wrong ID (mismatch)
						toolName: "",
						output: { type: "text" as const, value: "Content" },
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
			const assistantMessage: RooMessageParam = {
				role: "assistant",
				content: [
					{
						type: "tool-call",
						toolCallId: "tool-123",
						toolName: "read_file",
						input: { path: "test.txt" },
					},
				],
			}

			const userMessage: RooMessageParam = {
				role: "user",
				content: [
					{
						type: "tool-result",
						toolCallId: "tool-123",
						toolName: "",
						output: { type: "text" as const, value: "Content" },
					},
				],
			}

			validateAndFixToolResultIds(userMessage, [assistantMessage])

			expect(TelemetryService.instance.captureException).not.toHaveBeenCalled()
		})
	})
})
