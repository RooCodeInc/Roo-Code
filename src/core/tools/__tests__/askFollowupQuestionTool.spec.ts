import { askFollowupQuestionTool } from "../AskFollowupQuestionTool"
import { ToolUse } from "../../../shared/tools"
import { NativeToolCallParser } from "../../assistant-message/NativeToolCallParser"

describe("askFollowupQuestionTool", () => {
	let mockCline: any
	let mockPushToolResult: any
	let toolResult: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockCline = {
			ask: vi.fn().mockResolvedValue({ text: "Test response" }),
			say: vi.fn().mockResolvedValue(undefined),
			consecutiveMistakeCount: 0,
		}

		mockPushToolResult = vi.fn((result) => {
			toolResult = result
		})
	})

	it("should parse suggestions without mode attributes", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "What would you like to do?",
				follow_up: "<suggest>Option 1</suggest><suggest>Option 2</suggest>",
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
			removeClosingTag: vi.fn((tag, content) => content),
			toolProtocol: "xml",
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining('"suggest":[{"answer":"Option 1"},{"answer":"Option 2"}]'),
			false,
		)
	})

	it("should parse suggestions with mode attributes", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "What would you like to do?",
				follow_up: '<suggest mode="code">Write code</suggest><suggest mode="debug">Debug issue</suggest>',
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
			removeClosingTag: vi.fn((tag, content) => content),
			toolProtocol: "xml",
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining(
				'"suggest":[{"answer":"Write code","mode":"code"},{"answer":"Debug issue","mode":"debug"}]',
			),
			false,
		)
	})

	it("should handle mixed suggestions with and without mode attributes", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "What would you like to do?",
				follow_up: '<suggest>Regular option</suggest><suggest mode="architect">Plan architecture</suggest>',
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
			removeClosingTag: vi.fn((tag, content) => content),
			toolProtocol: "xml",
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining(
				'"suggest":[{"answer":"Regular option"},{"answer":"Plan architecture","mode":"architect"}]',
			),
			false,
		)
	})

	it("should parse multiple questions from XML", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				questions: "<question>Question 1</question><question>Question 2</question>",
				follow_up: "",
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
			removeClosingTag: vi.fn((tag, content) => content),
			toolProtocol: "xml",
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining('"questions":["Question 1","Question 2"]'),
			false,
		)
	})

	it("should handle multiple questions in native protocol", async () => {
		const block: ToolUse<"ask_followup_question"> = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {},
			nativeArgs: {
				questions: ["Question A", "Question B"],
				follow_up: [{ text: "Okay", mode: "code" }],
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
			removeClosingTag: vi.fn((tag, content) => content),
			toolProtocol: "native",
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining('"questions":["Question A","Question B"]'),
			false,
		)
	})

	it("should handle multiple-choice questions in native protocol", async () => {
		const block: ToolUse<"ask_followup_question"> = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {},
			nativeArgs: {
				questions: [
					{ text: "Framework?", options: ["React", "Vue"] },
					"Project name?",
					{ text: "Deploy?", options: ["Yes", "No"] },
				],
				follow_up: [{ text: "Done", mode: "code" }],
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
			removeClosingTag: vi.fn((tag, content) => content),
			toolProtocol: "native",
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining(
				'"questions":[{"text":"Framework?","options":["React","Vue"]},"Project name?",{"text":"Deploy?","options":["Yes","No"]}]',
			),
			false,
		)
	})

	describe("handlePartial with native protocol", () => {
		it("should only send first question during partial streaming to avoid raw JSON display", async () => {
			const block: ToolUse<"ask_followup_question"> = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {},
				partial: true,
				nativeArgs: {
					questions: ["What would you like to do?"],
					follow_up: [
						{ text: "Option 1", mode: "code" },
						{ text: "Option 2", mode: "architect" },
					],
				},
			}

			await askFollowupQuestionTool.handle(mockCline, block, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
				removeClosingTag: vi.fn((tag, content) => content || ""),
				toolProtocol: "native",
			})

			// During partial streaming, only the first question should be sent (not JSON with suggestions)
			expect(mockCline.ask).toHaveBeenCalledWith("followup", "What would you like to do?", true)
		})

		it("should handle partial with multiple questions", async () => {
			const block: ToolUse<"ask_followup_question"> = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {},
				partial: true,
				nativeArgs: {
					questions: ["Question 1", "Question 2"],
					follow_up: [],
				},
			}

			await askFollowupQuestionTool.handle(mockCline, block, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
				removeClosingTag: vi.fn((tag, content) => content || ""),
				toolProtocol: "native",
			})

			// Should show first question during streaming
			expect(mockCline.ask).toHaveBeenCalledWith("followup", "Question 1", true)
		})
	})

	describe("NativeToolCallParser.createPartialToolUse for ask_followup_question", () => {
		beforeEach(() => {
			NativeToolCallParser.clearAllStreamingToolCalls()
			NativeToolCallParser.clearRawChunkState()
		})

		it("should build nativeArgs with questions and follow_up during streaming", () => {
			// Start a streaming tool call
			NativeToolCallParser.startStreamingToolCall("call_123", "ask_followup_question")

			// Simulate streaming JSON chunks
			const chunk1 = '{"questions":["What would you like?"],"follow_up":[{"text":"Option 1","mode":"code"}'
			const result1 = NativeToolCallParser.processStreamingChunk("call_123", chunk1)

			expect(result1).not.toBeNull()
			expect(result1?.name).toBe("ask_followup_question")
			expect(result1?.nativeArgs).toBeDefined()
			// Use type assertion to access the specific fields
			const nativeArgs = result1?.nativeArgs as {
				questions: string[]
				follow_up?: Array<{ text: string; mode?: string }>
			}
			expect(nativeArgs?.questions).toEqual(["What would you like?"])
			// partial-json should parse the incomplete array
			expect(nativeArgs?.follow_up).toBeDefined()
		})

		it("should finalize with complete nativeArgs including complex questions", () => {
			NativeToolCallParser.startStreamingToolCall("call_456", "ask_followup_question")

			// Add complete JSON
			const completeJson =
				'{"questions":[{"text":"Framework?","options":["React","Vue"]},"Name?"],"follow_up":[{"text":"Yes","mode":"code"},{"text":"No","mode":"architect"}]}'
			NativeToolCallParser.processStreamingChunk("call_456", completeJson)

			const result = NativeToolCallParser.finalizeStreamingToolCall("call_456")

			expect(result).not.toBeNull()
			expect(result?.type).toBe("tool_use")
			expect(result?.name).toBe("ask_followup_question")
			expect(result?.partial).toBe(false)
			// Type guard: regular tools have type 'tool_use', MCP tools have type 'mcp_tool_use'
			if (result?.type === "tool_use") {
				expect(result.nativeArgs).toEqual({
					questions: [{ text: "Framework?", options: ["React", "Vue"] }, "Name?"],
					follow_up: [
						{ text: "Yes", mode: "code" },
						{ text: "No", mode: "architect" },
					],
				})
			}
		})
	})
})
