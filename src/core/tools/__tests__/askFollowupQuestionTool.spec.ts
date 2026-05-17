import { askFollowupQuestionTool, coerceFollowUp } from "../AskFollowupQuestionTool"
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
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
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
			},
			nativeArgs: {
				question: "What would you like to do?",
				follow_up: [{ text: "Option 1" }, { text: "Option 2" }],
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining('"suggest":[{"answer":"Option 1","mode":null},{"answer":"Option 2","mode":null}]'),
			false,
		)
	})

	it("should parse suggestions with mode attributes", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "What would you like to do?",
			},
			nativeArgs: {
				question: "What would you like to do?",
				follow_up: [
					{ text: "Write code", mode: "code" },
					{ text: "Debug issue", mode: "debug" },
				],
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
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
			},
			nativeArgs: {
				question: "What would you like to do?",
				follow_up: [{ text: "Regular option" }, { text: "Plan architecture", mode: "architect" }],
			},
			partial: false,
		}

		await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
			askApproval: vi.fn(),
			handleError: vi.fn(),
			pushToolResult: mockPushToolResult,
		})

		expect(mockCline.ask).toHaveBeenCalledWith(
			"followup",
			expect.stringContaining(
				'"suggest":[{"answer":"Regular option","mode":null},{"answer":"Plan architecture","mode":"architect"}]',
			),
			false,
		)
	})

	describe("parameter validation", () => {
		it("should handle missing follow_up parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
				},
				nativeArgs: {
					question: "What would you like to do?",
					follow_up: undefined as any,
				},
				partial: false,
			}

			await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("ask_followup_question", "follow_up")
			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.didToolFailInCurrentTurn).toBe(true)
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.ask).not.toHaveBeenCalled()
		})

		it("should handle null follow_up parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
				},
				nativeArgs: {
					question: "What would you like to do?",
					follow_up: null as any,
				},
				partial: false,
			}

			await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("ask_followup_question", "follow_up")
			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.didToolFailInCurrentTurn).toBe(true)
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.ask).not.toHaveBeenCalled()
		})

		it("should coerce a plain string follow_up into a single-item array", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
				},
				nativeArgs: {
					question: "What would you like to do?",
					follow_up: "not an array" as any,
				} as any,
				partial: false,
			}

			await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			// Plain string should be coerced to [{ text: "not an array" }]
			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining('"suggest":[{"answer":"not an array","mode":null}]'),
				false,
			)
		})

		it("should coerce a JSON string array follow_up into a proper array", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
				},
				nativeArgs: {
					question: "What would you like to do?",
					follow_up: '[{"text":"Option A"},{"text":"Option B","mode":"code"}]' as any,
				} as any,
				partial: false,
			}

			await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			// JSON string should be parsed into a proper array
			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining(
					'"suggest":[{"answer":"Option A","mode":null},{"answer":"Option B","mode":"code"}]',
				),
				false,
			)
		})

		it("should handle number follow_up parameter as missing", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
				},
				nativeArgs: {
					question: "What would you like to do?",
					follow_up: 42 as any,
				} as any,
				partial: false,
			}

			await askFollowupQuestionTool.handle(mockCline, block as ToolUse<"ask_followup_question">, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("ask_followup_question", "follow_up")
			expect(mockCline.ask).not.toHaveBeenCalled()
		})
	})

	describe("coerceFollowUp helper", () => {
		it("should normalize arrays to include mode: null when missing", () => {
			const input = [{ text: "Option 1" }, { text: "Option 2" }]
			expect(coerceFollowUp(input)).toEqual([
				{ text: "Option 1", mode: null },
				{ text: "Option 2", mode: null },
			])
		})

		it("should preserve existing mode values in arrays", () => {
			const input = [{ text: "Option 1", mode: "code" }, { text: "Option 2" }]
			expect(coerceFollowUp(input)).toEqual([
				{ text: "Option 1", mode: "code" },
				{ text: "Option 2", mode: null },
			])
		})

		it("should parse a JSON string containing an array", () => {
			const input = '[{"text":"A"},{"text":"B","mode":"code"}]'
			expect(coerceFollowUp(input)).toEqual([
				{ text: "A", mode: null },
				{ text: "B", mode: "code" },
			])
		})

		it("should wrap a plain string as a single suggestion with mode: null", () => {
			expect(coerceFollowUp("some option")).toEqual([{ text: "some option", mode: null }])
		})

		it("should return undefined for null", () => {
			expect(coerceFollowUp(null)).toBeUndefined()
		})

		it("should return undefined for undefined", () => {
			expect(coerceFollowUp(undefined)).toBeUndefined()
		})

		it("should return undefined for empty string", () => {
			expect(coerceFollowUp("")).toBeUndefined()
		})

		it("should return undefined for whitespace-only string", () => {
			expect(coerceFollowUp("   ")).toBeUndefined()
		})

		it("should wrap a JSON string that parses to a non-array as a suggestion with mode: null", () => {
			// A JSON string like '{"text":"hello"}' is valid JSON but not an array
			expect(coerceFollowUp('{"text":"hello"}')).toEqual([{ text: '{"text":"hello"}', mode: null }])
		})
	})

	describe("handlePartial with native protocol", () => {
		it("should only send question during partial streaming to avoid raw JSON display", async () => {
			const block: ToolUse<"ask_followup_question"> = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
				},
				partial: true,
				nativeArgs: {
					question: "What would you like to do?",
					follow_up: [{ text: "Option 1", mode: "code" }, { text: "Option 2" }],
				},
			}

			await askFollowupQuestionTool.handle(mockCline, block, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			// During partial streaming, only the question should be sent (not JSON with suggestions)
			expect(mockCline.ask).toHaveBeenCalledWith("followup", "What would you like to do?", true)
		})

		it("should handle partial with question from params", async () => {
			const block: ToolUse<"ask_followup_question"> = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "Choose wisely",
				},
				partial: true,
			}

			await askFollowupQuestionTool.handle(mockCline, block, {
				askApproval: vi.fn(),
				handleError: vi.fn(),
				pushToolResult: mockPushToolResult,
			})

			expect(mockCline.ask).toHaveBeenCalledWith("followup", "Choose wisely", true)
		})
	})

	describe("NativeToolCallParser.createPartialToolUse for ask_followup_question", () => {
		beforeEach(() => {
			NativeToolCallParser.clearAllStreamingToolCalls()
			NativeToolCallParser.clearRawChunkState()
		})

		it("should build nativeArgs with question and follow_up during streaming", () => {
			// Start a streaming tool call
			NativeToolCallParser.startStreamingToolCall("call_123", "ask_followup_question")

			// Simulate streaming JSON chunks
			const chunk1 = '{"question":"What would you like?","follow_up":[{"text":"Option 1","mode":"code"}'
			const result1 = NativeToolCallParser.processStreamingChunk("call_123", chunk1)

			expect(result1).not.toBeNull()
			expect(result1?.name).toBe("ask_followup_question")
			expect(result1?.params.question).toBe("What would you like?")
			expect(result1?.nativeArgs).toBeDefined()
			// Use type assertion to access the specific fields
			const nativeArgs = result1?.nativeArgs as {
				question: string
				follow_up?: Array<{ text: string; mode?: string }>
			}
			expect(nativeArgs?.question).toBe("What would you like?")
			// partial-json should parse the incomplete array
			expect(nativeArgs?.follow_up).toBeDefined()
		})

		it("should finalize with complete nativeArgs", () => {
			NativeToolCallParser.startStreamingToolCall("call_456", "ask_followup_question")

			// Add complete JSON
			const completeJson =
				'{"question":"Choose an option","follow_up":[{"text":"Yes","mode":"code"},{"text":"No","mode":null}]}'
			NativeToolCallParser.processStreamingChunk("call_456", completeJson)

			const result = NativeToolCallParser.finalizeStreamingToolCall("call_456")

			expect(result).not.toBeNull()
			expect(result?.type).toBe("tool_use")
			expect(result?.name).toBe("ask_followup_question")
			expect(result?.partial).toBe(false)
			// Type guard: regular tools have type 'tool_use', MCP tools have type 'mcp_tool_use'
			if (result?.type === "tool_use") {
				expect(result.nativeArgs).toEqual({
					question: "Choose an option",
					follow_up: [
						{ text: "Yes", mode: "code" },
						{ text: "No", mode: null },
					],
				})
			}
		})

		it("should coerce string follow_up to array during finalization", () => {
			NativeToolCallParser.startStreamingToolCall("call_789", "ask_followup_question")

			// Simulate a model that outputs follow_up as a plain string
			const jsonWithStringFollowUp = '{"question":"Pick one","follow_up":"Option A"}'
			NativeToolCallParser.processStreamingChunk("call_789", jsonWithStringFollowUp)

			const result = NativeToolCallParser.finalizeStreamingToolCall("call_789")

			expect(result).not.toBeNull()
			expect(result?.type).toBe("tool_use")
			if (result?.type === "tool_use") {
				const nativeArgs = result.nativeArgs as {
					question: string
					follow_up: Array<{ text: string; mode?: string }>
				}
				expect(nativeArgs.question).toBe("Pick one")
				expect(nativeArgs.follow_up).toEqual([{ text: "Option A", mode: null }])
			}
		})

		it("should coerce JSON-string follow_up to array during finalization", () => {
			NativeToolCallParser.startStreamingToolCall("call_101", "ask_followup_question")

			// Simulate a model that outputs follow_up as a JSON string of an array
			const jsonWithJsonStringFollowUp =
				'{"question":"Pick one","follow_up":"[{\\"text\\":\\"A\\"},{\\"text\\":\\"B\\"}]"}'
			NativeToolCallParser.processStreamingChunk("call_101", jsonWithJsonStringFollowUp)

			const result = NativeToolCallParser.finalizeStreamingToolCall("call_101")

			expect(result).not.toBeNull()
			expect(result?.type).toBe("tool_use")
			if (result?.type === "tool_use") {
				const nativeArgs = result.nativeArgs as {
					question: string
					follow_up: Array<{ text: string; mode?: string }>
				}
				expect(nativeArgs.question).toBe("Pick one")
				expect(nativeArgs.follow_up).toEqual([
					{ text: "A", mode: null },
					{ text: "B", mode: null },
				])
			}
		})
	})
})
