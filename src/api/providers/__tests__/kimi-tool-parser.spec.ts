// npx vitest run api/providers/__tests__/kimi-tool-parser.spec.ts

import { describe, it, expect, beforeEach } from "vitest"
import { KimiToolCallParser } from "../kimi-tool-parser"

describe("KimiToolCallParser", () => {
	let parser: KimiToolCallParser

	beforeEach(() => {
		parser = new KimiToolCallParser()
	})

	describe("processChunk", () => {
		it("should parse a complete tool call section", () => {
			const chunk = `I'll help you with that. <|tool_calls_section_begin|> <|tool_call_begin|> functions.codebase_search:12 <|tool_call_argument_begin|> {"query": "TeamSelect scene", "path": "ouroboros"} <|tool_call_end|> <|tool_calls_section_end|>`

			const results = parser.processChunk(chunk)

			expect(results).toHaveLength(2)
			expect(results[0]).toEqual({
				type: "text",
				content: "I'll help you with that. ",
			})
			expect(results[1]).toEqual({
				type: "tool_call",
				toolCall: {
					id: "tool_call_12",
					name: "codebase_search",
					arguments: '{"query":"TeamSelect scene","path":"ouroboros"}',
				},
			})
		})

		it("should handle tool calls without functions prefix", () => {
			const chunk = `<|tool_calls_section_begin|> <|tool_call_begin|> read_file:5 <|tool_call_argument_begin|> {"path": "test.ts"} <|tool_call_end|> <|tool_calls_section_end|>`

			const results = parser.processChunk(chunk)

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				type: "tool_call",
				toolCall: {
					id: "tool_call_5",
					name: "read_file",
					arguments: '{"path":"test.ts"}',
				},
			})
		})

		it("should handle partial tool call sections across chunks", () => {
			const chunk1 = `Some text before <|tool_calls_section_begin|> <|tool_call_begin|> functions.`
			const chunk2 = `search_files:15 <|tool_call_argument_begin|> {"query": "test"} <|tool_call_end|> <|tool_calls_section_end|> and text after`

			const results1 = parser.processChunk(chunk1)
			expect(results1).toHaveLength(1)
			expect(results1[0]).toEqual({
				type: "text",
				content: "Some text before ",
			})

			const results2 = parser.processChunk(chunk2)
			expect(results2).toHaveLength(2)
			expect(results2[0]).toEqual({
				type: "tool_call",
				toolCall: {
					id: "tool_call_15",
					name: "search_files",
					arguments: '{"query":"test"}',
				},
			})
			expect(results2[1]).toEqual({
				type: "text",
				content: " and text after",
			})
		})

		it("should handle multiple tool calls in sequence", () => {
			const chunk = `<|tool_calls_section_begin|> <|tool_call_begin|> functions.read_file:1 <|tool_call_argument_begin|> {"path": "file1.ts"} <|tool_call_end|> <|tool_calls_section_end|> Then <|tool_calls_section_begin|> <|tool_call_begin|> functions.write_file:2 <|tool_call_argument_begin|> {"path": "file2.ts", "content": "test"} <|tool_call_end|> <|tool_calls_section_end|>`

			const results = parser.processChunk(chunk)

			expect(results).toHaveLength(3)
			expect(results[0].type).toBe("tool_call")
			expect(results[0].toolCall?.name).toBe("read_file")
			expect(results[1].type).toBe("text")
			expect(results[1].content).toBe(" Then ")
			expect(results[2].type).toBe("tool_call")
			expect(results[2].toolCall?.name).toBe("write_file")
		})

		it("should handle text without tool calls", () => {
			const chunk = "This is just regular text without any tool calls."

			const results = parser.processChunk(chunk)

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				type: "text",
				content: "This is just regular text without any tool calls.",
			})
		})

		it("should handle malformed tool call sections gracefully", () => {
			const chunk = `<|tool_calls_section_begin|> <|tool_call_begin|> invalid_format <|tool_call_end|> <|tool_calls_section_end|>`

			const results = parser.processChunk(chunk)

			// Should not parse as tool call due to invalid format
			expect(results).toHaveLength(0)
		})

		it("should handle invalid JSON in tool arguments", () => {
			const chunk = `<|tool_calls_section_begin|> <|tool_call_begin|> functions.test:1 <|tool_call_argument_begin|> {invalid json} <|tool_call_end|> <|tool_calls_section_end|>`

			const results = parser.processChunk(chunk)

			// Should not parse as tool call due to invalid JSON
			expect(results).toHaveLength(0)
		})
	})

	describe("flush", () => {
		it("should return remaining buffer content", () => {
			const chunk = "Some incomplete text <|tool_calls_section_begin"

			parser.processChunk(chunk)
			const results = parser.flush()

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				type: "text",
				content: "Some incomplete text <|tool_calls_section_begin",
			})
		})

		it("should return empty array when buffer is empty", () => {
			const results = parser.flush()
			expect(results).toHaveLength(0)
		})

		it("should clear buffer after flush", () => {
			parser.processChunk("Some text")
			parser.flush()
			const secondFlush = parser.flush()
			expect(secondFlush).toHaveLength(0)
		})
	})
})
