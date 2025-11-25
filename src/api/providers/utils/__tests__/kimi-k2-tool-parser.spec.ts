import { describe, it, expect } from "vitest"
import { KimiK2ToolCallParser } from "../kimi-k2-tool-parser"

describe("KimiK2ToolCallParser", () => {
	describe("isKimiK2Model", () => {
		it("should identify Kimi K2 models correctly", () => {
			expect(KimiK2ToolCallParser.isKimiK2Model("Kimi-K2-Thinking")).toBe(true)
			expect(KimiK2ToolCallParser.isKimiK2Model("kimi-k2-thinking")).toBe(true)
			expect(KimiK2ToolCallParser.isKimiK2Model("Kimi-K2")).toBe(true)
			expect(KimiK2ToolCallParser.isKimiK2Model("kimi-thinking")).toBe(true)
			expect(KimiK2ToolCallParser.isKimiK2Model("KIMI-K2-THINKING")).toBe(true)
		})

		it("should not identify non-Kimi K2 models", () => {
			expect(KimiK2ToolCallParser.isKimiK2Model("gpt-4")).toBe(false)
			expect(KimiK2ToolCallParser.isKimiK2Model("claude-3")).toBe(false)
			expect(KimiK2ToolCallParser.isKimiK2Model("kimi-v1")).toBe(false)
			expect(KimiK2ToolCallParser.isKimiK2Model("thinking-model")).toBe(false)
		})
	})

	describe("processChunk", () => {
		it("should parse single tool call correctly", () => {
			const parser = new KimiK2ToolCallParser()

			const chunk1 = "Let me read the file.\n<|tool_calls_section_begin|>"
			const chunk2 = "<|tool_call_begin|>functions.read_file:0"
			const chunk3 = '<|tool_call_argument_begin|>{"files":[{"path":"test.txt"}]}'
			const chunk4 = "<|tool_call_end|><|tool_calls_section_end|>"

			let result = parser.processChunk(chunk1)
			expect(result.content).toBe("Let me read the file.\n")
			expect(result.toolCalls).toHaveLength(0)
			expect(result.isBuffering).toBe(true)

			result = parser.processChunk(chunk2)
			expect(result.content).toBe("")
			expect(result.toolCalls).toHaveLength(0)
			expect(result.isBuffering).toBe(true)

			result = parser.processChunk(chunk3)
			expect(result.content).toBe("")
			expect(result.toolCalls).toHaveLength(0)
			expect(result.isBuffering).toBe(true)

			result = parser.processChunk(chunk4)
			expect(result.content).toBe("")
			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0]).toEqual({
				id: "tool_0",
				name: "read_file",
				arguments: '{"files":[{"path":"test.txt"}]}',
			})
			expect(result.isBuffering).toBe(false)
		})

		it("should parse multiple tool calls", () => {
			const parser = new KimiK2ToolCallParser()

			const input = `<|tool_calls_section_begin|>
<|tool_call_begin|>functions.read_file:0<|tool_call_argument_begin|>{"files":[{"path":"file1.txt"}]}<|tool_call_end|>
<|tool_call_begin|>functions.write_to_file:1<|tool_call_argument_begin|>{"path":"file2.txt","content":"Test","line_count":1}<|tool_call_end|>
<|tool_calls_section_end|>`

			const result = parser.processChunk(input)
			expect(result.content).toBe("")
			expect(result.toolCalls).toHaveLength(2)
			expect(result.toolCalls[0]).toEqual({
				id: "tool_0",
				name: "read_file",
				arguments: '{"files":[{"path":"file1.txt"}]}',
			})
			expect(result.toolCalls[1]).toEqual({
				id: "tool_1",
				name: "write_to_file",
				arguments: '{"path":"file2.txt","content":"Test","line_count":1}',
			})
			expect(result.isBuffering).toBe(false)
		})

		it("should handle mixed content and tool calls", () => {
			const parser = new KimiK2ToolCallParser()

			const input = `I'll help you with that. Let me first read the file.
<|tool_calls_section_begin|>
<|tool_call_begin|>functions.read_file:0<|tool_call_argument_begin|>{"files":[{"path":"config.json"}]}<|tool_call_end|>
<|tool_calls_section_end|>
Now let me process the data.`

			const result = parser.processChunk(input)
			expect(result.content).toContain("I'll help you with that")
			expect(result.content).toContain("Now let me process the data")
			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0]).toEqual({
				id: "tool_0",
				name: "read_file",
				arguments: '{"files":[{"path":"config.json"}]}',
			})
		})

		it("should handle chunked input correctly", () => {
			const parser = new KimiK2ToolCallParser()

			// Simulate streaming chunks that split across boundaries
			const chunks = [
				"Starting task\n<|tool_",
				"calls_section_begin|><|tool_call",
				"_begin|>functions.wr",
				"ite_to_file:0<|tool_call_argu",
				'ment_begin|>{"path":"test.md",',
				'"content":"# Test","line_count":1}<|tool_',
				"call_end|><|tool_calls_section_end|>\nDone!",
			]

			let allContent = ""
			let allToolCalls: any[] = []

			for (const chunk of chunks) {
				const result = parser.processChunk(chunk)
				allContent += result.content
				allToolCalls.push(...result.toolCalls)
			}

			expect(allContent).toBe("Starting task\n\nDone!")
			expect(allToolCalls).toHaveLength(1)
			expect(allToolCalls[0]).toEqual({
				id: "tool_0",
				name: "write_to_file",
				arguments: '{"path":"test.md","content":"# Test","line_count":1}',
			})
		})

		it("should handle tool calls with complex JSON arguments", () => {
			const parser = new KimiK2ToolCallParser()

			const input = `<|tool_calls_section_begin|>
<|tool_call_begin|>functions.apply_diff:0<|tool_call_argument_begin|>{
  "path": "src/main.ts",
  "diff": "<<<<<<< SEARCH\\nold code\\n=======\\nnew code\\n>>>>>>> REPLACE"
}<|tool_call_end|>
<|tool_calls_section_end|>`

			const result = parser.processChunk(input)
			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0].name).toBe("apply_diff")
			expect(result.toolCalls[0].arguments).toContain("<<<<<<< SEARCH")
			expect(result.toolCalls[0].arguments).toContain(">>>>>>> REPLACE")
		})
	})

	describe("flush", () => {
		it("should flush pending tool calls", () => {
			const parser = new KimiK2ToolCallParser()

			// Start a tool call but don't close it
			const chunk =
				'<|tool_calls_section_begin|><|tool_call_begin|>functions.read_file:0<|tool_call_argument_begin|>{"files":[{"path":"test.txt"}]}'

			let result = parser.processChunk(chunk)
			expect(result.toolCalls).toHaveLength(0)
			expect(result.isBuffering).toBe(true)

			// Force flush
			const flushed = parser.flush()
			expect(flushed.toolCalls).toHaveLength(1)
			expect(flushed.toolCalls[0]).toEqual({
				id: "tool_0",
				name: "read_file",
				arguments: '{"files":[{"path":"test.txt"}]}',
			})
		})

		it("should reset state after flush", () => {
			const parser = new KimiK2ToolCallParser()

			// Process partial tool call
			parser.processChunk("<|tool_calls_section_begin|><|tool_call_begin|>functions.test:0")

			// Flush
			parser.flush()

			// Process new content - should not be buffering
			const result = parser.processChunk("Regular content")
			expect(result.content).toBe("Regular content")
			expect(result.isBuffering).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should handle empty tool calls section", () => {
			const parser = new KimiK2ToolCallParser()

			const input = "<|tool_calls_section_begin|><|tool_calls_section_end|>"
			const result = parser.processChunk(input)

			expect(result.content).toBe("")
			expect(result.toolCalls).toHaveLength(0)
			expect(result.isBuffering).toBe(false)
		})

		it("should handle newlines in tool name/id section", () => {
			const parser = new KimiK2ToolCallParser()

			const input = `<|tool_calls_section_begin|>
<|tool_call_begin|>
functions.read_file:0
<|tool_call_argument_begin|>{"files":[{"path":"test.txt"}]}<|tool_call_end|>
<|tool_calls_section_end|>`

			const result = parser.processChunk(input)
			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0].name).toBe("read_file")
			expect(result.toolCalls[0].id).toBe("tool_0")
		})

		it("should handle tool calls without arguments", () => {
			const parser = new KimiK2ToolCallParser()

			const input =
				"<|tool_calls_section_begin|><|tool_call_begin|>functions.get_status:0<|tool_call_argument_begin|>{}<|tool_call_end|><|tool_calls_section_end|>"

			const result = parser.processChunk(input)
			expect(result.toolCalls).toHaveLength(1)
			expect(result.toolCalls[0]).toEqual({
				id: "tool_0",
				name: "get_status",
				arguments: "{}",
			})
		})
	})
})
