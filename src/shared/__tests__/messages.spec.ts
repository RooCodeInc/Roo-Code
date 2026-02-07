import { Anthropic } from "@anthropic-ai/sdk"
import { normalizeContentBlocks } from "../messages"

describe("normalizeContentBlocks", () => {
	it("returns the array unchanged when content is already an array", () => {
		const blocks: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "text", text: "hello" },
			{ type: "tool_use", id: "tool-1", name: "read_file", input: { path: "a.ts" } },
		]

		const result = normalizeContentBlocks(blocks)
		expect(result).toBe(blocks) // same reference
	})

	it("wraps a plain string in a single text block", () => {
		const result = normalizeContentBlocks("hello world")
		expect(result).toEqual([{ type: "text", text: "hello world" }])
	})

	it("wraps an empty string in a text block with empty text", () => {
		const result = normalizeContentBlocks("")
		expect(result).toEqual([{ type: "text", text: "" }])
	})

	it("returns an empty array unchanged", () => {
		const empty: Anthropic.Messages.ContentBlockParam[] = []
		const result = normalizeContentBlocks(empty)
		expect(result).toBe(empty)
	})

	it("preserves tool_result blocks in the array", () => {
		const blocks: Anthropic.Messages.ContentBlockParam[] = [
			{ type: "tool_result", tool_use_id: "tool-1", content: "result" },
		]

		const result = normalizeContentBlocks(blocks)
		expect(result).toBe(blocks)
		expect(result[0].type).toBe("tool_result")
	})
})
