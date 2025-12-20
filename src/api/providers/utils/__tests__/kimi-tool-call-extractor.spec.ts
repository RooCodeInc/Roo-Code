import {
	hasKimiEmbeddedToolCalls,
	extractKimiToolCalls,
	isKimiThinkingModel,
	type KimiToolCall,
} from "../kimi-tool-call-extractor"

describe("kimi-tool-call-extractor", () => {
	describe("hasKimiEmbeddedToolCalls", () => {
		it("should return true when content contains tool call markers with delimiters", () => {
			const content = "Some reasoning <|tool_calls_section_begin|> stuff <|tool_calls_section_end|>"
			expect(hasKimiEmbeddedToolCalls(content)).toBe(true)
		})

		it("should return true when content contains tool call markers without delimiters", () => {
			const content = "Some reasoning tool_calls_section_begin stuff tool_calls_section_end"
			expect(hasKimiEmbeddedToolCalls(content)).toBe(true)
		})

		it("should return false when content does not contain tool call markers", () => {
			const content = "Just regular reasoning content without any tool calls"
			expect(hasKimiEmbeddedToolCalls(content)).toBe(false)
		})

		it("should return false for empty string", () => {
			expect(hasKimiEmbeddedToolCalls("")).toBe(false)
		})
	})

	describe("extractKimiToolCalls", () => {
		it("should extract single tool call from reasoning content with delimiters", () => {
			const content = `Some reasoning here
<|tool_calls_section_begin|>
<|tool_call_begin|>functions.read_file:0<|tool_call_argument_begin|>{"files":[{"path":"test.txt"}]}<|tool_call_end|>
<|tool_calls_section_end|>
More content after`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0]).toEqual({
				id: "kimi-functions.read_file:0",
				type: "function",
				function: {
					name: "read_file",
					arguments: '{"files":[{"path":"test.txt"}]}',
				},
			})
			expect(result.cleanedReasoningContent).not.toContain("tool_calls_section_begin")
			expect(result.cleanedReasoningContent).toContain("Some reasoning here")
			expect(result.cleanedReasoningContent).toContain("More content after")
		})

		it("should extract single tool call from reasoning content without delimiters", () => {
			const content = `Some reasoning here
tool_calls_section_begin
tool_call_begin functions.read_file:0 tool_call_argument_begin {"files":[{"path":"test.txt"}]} tool_call_end
tool_calls_section_end
More content after`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0]).toEqual({
				id: "kimi-functions.read_file:0",
				type: "function",
				function: {
					name: "read_file",
					arguments: '{"files":[{"path":"test.txt"}]}',
				},
			})
			expect(result.cleanedReasoningContent).not.toContain("tool_calls_section_begin")
			expect(result.cleanedReasoningContent).toContain("Some reasoning here")
			expect(result.cleanedReasoningContent).toContain("More content after")
		})

		it("should extract multiple tool calls from reasoning content", () => {
			const content = `Thinking about what to do
<|tool_calls_section_begin|>
<|tool_call_begin|>functions.read_file:0<|tool_call_argument_begin|>{"files":[{"path":"file1.txt"}]}<|tool_call_end|>
<|tool_call_begin|>functions.execute_command:1<|tool_call_argument_begin|>{"command":"ls -la"}<|tool_call_end|>
<|tool_calls_section_end|>`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(2)
			expect(result.toolCalls[0]).toEqual({
				id: "kimi-functions.read_file:0",
				type: "function",
				function: {
					name: "read_file",
					arguments: '{"files":[{"path":"file1.txt"}]}',
				},
			})
			expect(result.toolCalls[1]).toEqual({
				id: "kimi-functions.execute_command:1",
				type: "function",
				function: {
					name: "execute_command",
					arguments: '{"command":"ls -la"}',
				},
			})
		})

		it("should handle tool calls without functions. prefix", () => {
			const content = `<|tool_calls_section_begin|>
<|tool_call_begin|>read_file:0<|tool_call_argument_begin|>{"files":[{"path":"test.txt"}]}<|tool_call_end|>
<|tool_calls_section_end|>`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0].function.name).toBe("read_file")
		})

		it("should return empty array when no tool calls are present", () => {
			const content = "Just regular content without tool calls"
			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(0)
			expect(result.cleanedReasoningContent).toBe(content)
		})

		it("should return empty array when tool call section is empty", () => {
			const content = `Some content
<|tool_calls_section_begin|>
<|tool_calls_section_end|>`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(0)
		})

		it("should clean reasoning content by removing tool call sections", () => {
			const content =
				"Before tool calls\n<|tool_calls_section_begin|>\n<|tool_call_begin|>functions.test:0<|tool_call_argument_begin|>{}<|tool_call_end|>\n<|tool_calls_section_end|>\nAfter tool calls"

			const result = extractKimiToolCalls(content)

			// The cleaned content should not contain tool call markers
			expect(result.cleanedReasoningContent).not.toContain("tool_calls_section_begin")
			expect(result.cleanedReasoningContent).not.toContain("tool_calls_section_end")
			expect(result.cleanedReasoningContent).not.toContain("tool_call_begin")
			expect(result.cleanedReasoningContent).toContain("Before tool calls")
			expect(result.cleanedReasoningContent).toContain("After tool calls")
		})

		it("should handle complex JSON arguments", () => {
			const content = `<|tool_calls_section_begin|>
<|tool_call_begin|>functions.write_to_file:0<|tool_call_argument_begin|>{"path":"src/test.ts","content":"function test() {\\n  return 'hello';\\n}"}<|tool_call_end|>
<|tool_calls_section_end|>`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0].function.arguments).toBe(
				'{"path":"src/test.ts","content":"function test() {\\n  return \'hello\';\\n}"}',
			)
		})

		it("should handle multiple tool call sections", () => {
			const content = `First reasoning
<|tool_calls_section_begin|>
<|tool_call_begin|>functions.tool1:0<|tool_call_argument_begin|>{"arg":"value1"}<|tool_call_end|>
<|tool_calls_section_end|>
Middle reasoning
<|tool_calls_section_begin|>
<|tool_call_begin|>functions.tool2:1<|tool_call_argument_begin|>{"arg":"value2"}<|tool_call_end|>
<|tool_calls_section_end|>
End reasoning`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(2)
			expect(result.toolCalls[0].function.name).toBe("tool1")
			expect(result.toolCalls[1].function.name).toBe("tool2")
		})

		it("should handle markers without delimiters", () => {
			const content = `Some reasoning
tool_calls_section_begin
tool_call_begin functions.read_file:0 tool_call_argument_begin {"path":"test.txt"} tool_call_end
tool_calls_section_end`

			const result = extractKimiToolCalls(content)

			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0].function.name).toBe("read_file")
		})
	})

	describe("isKimiThinkingModel", () => {
		it("should return true for kimi-k2-thinking model", () => {
			expect(isKimiThinkingModel("kimi-k2-thinking")).toBe(true)
		})

		it("should return true for model with kimi-k2-thinking prefix", () => {
			expect(isKimiThinkingModel("moonshotai/kimi-k2-thinking")).toBe(true)
		})

		it("should be case insensitive", () => {
			expect(isKimiThinkingModel("Kimi-K2-Thinking")).toBe(true)
			expect(isKimiThinkingModel("KIMI-K2-THINKING")).toBe(true)
		})

		it("should handle underscore variations", () => {
			expect(isKimiThinkingModel("kimi_k2_thinking")).toBe(true)
		})

		it("should return false for non-thinking kimi models", () => {
			expect(isKimiThinkingModel("kimi-k2")).toBe(false)
			expect(isKimiThinkingModel("kimi-k2-0905-preview")).toBe(false)
			expect(isKimiThinkingModel("kimi-k2-turbo-preview")).toBe(false)
		})

		it("should return false for other models", () => {
			expect(isKimiThinkingModel("gpt-4")).toBe(false)
			expect(isKimiThinkingModel("claude-3-opus")).toBe(false)
			expect(isKimiThinkingModel("deepseek-reasoner")).toBe(false)
		})
	})
})
