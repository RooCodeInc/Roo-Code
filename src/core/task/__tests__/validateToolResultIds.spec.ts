import { Anthropic } from "@anthropic-ai/sdk"
import {
	validateAndFixToolResultIds,
	validateMessageHistoryBeforeSend,
	ToolResultIdMismatchError,
	MissingToolResultError,
} from "../validateToolResultIds"

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
			// This is the exact mismatched tool result scenario:
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
})

describe("validateMessageHistoryBeforeSend", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return the same array reference when all tool_use blocks have matching tool_results", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "foo.ts" } },
					{ type: "tool_use", id: "tool_2", name: "read_file", input: { path: "bar.ts" } },
				],
			},
			{
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tool_1", content: "file contents 1" },
					{ type: "tool_result", tool_use_id: "tool_2", content: "file contents 2" },
				],
			},
		]

		const result = validateMessageHistoryBeforeSend(messages)
		expect(result).toBe(messages) // Same reference = no modification
		expect(TelemetryService.instance.captureException).not.toHaveBeenCalled()
	})

	it("should inject placeholder tool_results for missing tool_use IDs", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "foo.ts" } },
					{ type: "tool_use", id: "tool_2", name: "read_file", input: { path: "bar.ts" } },
					{ type: "tool_use", id: "tool_3", name: "read_file", input: { path: "baz.ts" } },
					{ type: "tool_use", id: "tool_4", name: "read_file", input: { path: "qux.ts" } },
				],
			},
			{
				role: "user",
				content: [
					{ type: "tool_result", tool_use_id: "tool_1", content: "result 1" },
					// tool_2, tool_3, tool_4 are missing
				],
			},
		]

		const result = validateMessageHistoryBeforeSend(messages)

		// Should have the same number of messages
		expect(result.length).toBe(3)

		// The patched user message should contain placeholders for tool_2, tool_3, tool_4
		const patchedUser = result[2]
		expect(patchedUser.role).toBe("user")
		const content = patchedUser.content as Anthropic.Messages.ContentBlockParam[]

		// 3 placeholders + 1 existing tool_result = 4
		expect(content.length).toBe(4)

		const toolResults = content.filter((b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result")
		expect(toolResults.length).toBe(4)

		const toolResultIds = toolResults.map((r) => r.tool_use_id)
		expect(toolResultIds).toContain("tool_1")
		expect(toolResultIds).toContain("tool_2")
		expect(toolResultIds).toContain("tool_3")
		expect(toolResultIds).toContain("tool_4")

		// Should report to telemetry
		expect(TelemetryService.instance.captureException).toHaveBeenCalledTimes(1)
		const capturedError = (TelemetryService.instance.captureException as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(capturedError).toBeInstanceOf(MissingToolResultError)
		expect(capturedError.missingToolUseIds).toEqual(["tool_2", "tool_3", "tool_4"])
	})

	it("should insert a synthetic user message when no following user message exists", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "foo.ts" } }],
			},
			// No following user message
		]

		const result = validateMessageHistoryBeforeSend(messages)

		// Should now have 3 messages (synthetic user message added)
		expect(result.length).toBe(3)
		expect(result[2].role).toBe("user")

		const content = result[2].content as Anthropic.ToolResultBlockParam[]
		expect(content.length).toBe(1)
		expect(content[0].type).toBe("tool_result")
		expect(content[0].tool_use_id).toBe("tool_1")
		expect(content[0].content).toBe("Tool execution was interrupted before completion.")
	})

	it("should handle multiple assistant messages with tool_use blocks", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "foo.ts" } }],
			},
			{
				role: "user",
				content: [{ type: "tool_result", tool_use_id: "tool_1", content: "result 1" }],
			},
			{
				role: "assistant",
				content: [
					{ type: "tool_use", id: "tool_2", name: "read_file", input: { path: "bar.ts" } },
					{ type: "tool_use", id: "tool_3", name: "read_file", input: { path: "baz.ts" } },
				],
			},
			{
				role: "user",
				content: [
					// Only tool_2 has a result, tool_3 is missing
					{ type: "tool_result", tool_use_id: "tool_2", content: "result 2" },
				],
			},
		]

		const result = validateMessageHistoryBeforeSend(messages)

		expect(result.length).toBe(5)

		// First pair should be untouched
		const firstUserContent = result[2].content as Anthropic.Messages.ContentBlockParam[]
		expect(firstUserContent.length).toBe(1)

		// Second pair should have placeholder for tool_3
		const secondUserContent = result[4].content as Anthropic.Messages.ContentBlockParam[]
		const toolResults = secondUserContent.filter(
			(b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result",
		)
		expect(toolResults.length).toBe(2)
		expect(toolResults.map((r) => r.tool_use_id).sort()).toEqual(["tool_2", "tool_3"])
	})

	it("should not modify messages without tool_use blocks", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Hi there!" }],
			},
			{
				role: "user",
				content: [{ type: "text", text: "Thanks" }],
			},
		]

		const result = validateMessageHistoryBeforeSend(messages)
		expect(result).toBe(messages) // Same reference
	})

	it("should handle assistant messages with string content", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const result = validateMessageHistoryBeforeSend(messages)
		expect(result).toBe(messages)
	})

	it("should handle the next message being an assistant (not user)", () => {
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello" }],
			},
			{
				role: "assistant",
				content: [{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "foo.ts" } }],
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Continuing..." }],
			},
		]

		const result = validateMessageHistoryBeforeSend(messages)

		// Should insert a synthetic user message between the two assistant messages
		expect(result.length).toBe(4)
		expect(result[2].role).toBe("user")
		const syntheticContent = result[2].content as Anthropic.ToolResultBlockParam[]
		expect(syntheticContent[0].tool_use_id).toBe("tool_1")
		// The original second assistant message should still be there
		expect(result[3].role).toBe("assistant")
	})
})
