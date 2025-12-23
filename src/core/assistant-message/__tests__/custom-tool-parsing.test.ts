import { describe, it, expect } from "vitest"
import { AssistantMessageParser } from "../AssistantMessageParser"

describe("AssistantMessageParser with custom tools", () => {
	it("should parse built-in tools without custom tools", () => {
		const parser = new AssistantMessageParser()
		const message = "<read_file>\n<path>test.ts</path>\n</read_file>"

		const blocks = parser.processChunk(message)
		parser.finalizeContentBlocks()

		const toolBlocks = blocks.filter((b) => b.type === "tool_use")
		expect(toolBlocks).toHaveLength(1)
		expect(toolBlocks[0]).toMatchObject({
			type: "tool_use",
			name: "read_file",
			partial: false,
		})
	})

	it("should recognize custom tools when custom tool names are provided", () => {
		const parser = new AssistantMessageParser(["add_numbers"])
		const message = "<add_numbers>\n<num1>5</num1>\n<num22>10</num22>\n</add_numbers>"

		const blocks = parser.processChunk(message)
		parser.finalizeContentBlocks()

		const toolBlocks = blocks.filter((b) => b.type === "tool_use")
		// The key fix: custom tool is now recognized as tool_use, not text
		// This prevents the "noToolsUsed" error
		expect(toolBlocks).toHaveLength(1)
		expect(toolBlocks[0]).toMatchObject({
			type: "tool_use",
			name: "add_numbers",
			partial: false,
		})
		// Note: Custom tool parameter parsing is a separate concern
		// and would require extending toolParamNames dynamically
	})

	it("should treat unknown tool names as text when not in custom tools list", () => {
		const parser = new AssistantMessageParser()
		const message = "<add_numbers>\n<num1>5</num1>\n<num22>10</num22>\n</add_numbers>"

		const blocks = parser.processChunk(message)
		parser.finalizeContentBlocks()

		// Without custom tool names, add_numbers should be treated as text
		const textBlocks = blocks.filter((b) => b.type === "text")
		expect(textBlocks.length).toBeGreaterThan(0)
	})

	it("should recognize mix of built-in and custom tools", () => {
		const parser = new AssistantMessageParser(["add_numbers", "custom_tool"])
		const message = `I'll read the file first.
<read_file>
<path>test.ts</path>
</read_file>

Then I'll use the custom tool.
<add_numbers>
<num1>5</num1>
<num22>10</num22>
</add_numbers>`

		const blocks = parser.processChunk(message)
		parser.finalizeContentBlocks()

		expect(blocks.length).toBeGreaterThanOrEqual(4) // text, tool, text, tool

		const toolBlocks = blocks.filter((b) => b.type === "tool_use")
		// Both built-in and custom tools are recognized
		expect(toolBlocks).toHaveLength(2)
		expect(toolBlocks[0]).toMatchObject({
			name: "read_file",
		})
		expect(toolBlocks[1]).toMatchObject({
			name: "add_numbers",
		})
	})
})
