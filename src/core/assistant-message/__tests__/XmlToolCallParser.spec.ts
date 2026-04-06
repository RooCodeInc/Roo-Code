import { XmlToolCallParser } from "../XmlToolCallParser"

describe("XmlToolCallParser", () => {
	describe("containsXmlToolCall", () => {
		it("should detect complete function tags", () => {
			expect(XmlToolCallParser.containsXmlToolCall("<function=read_file>")).toBe(true)
			expect(XmlToolCallParser.containsXmlToolCall("<function=attempt_completion>")).toBe(true)
			expect(XmlToolCallParser.containsXmlToolCall("some text <function=read_file> more text")).toBe(true)
		})

		it("should detect partial function tags", () => {
			expect(XmlToolCallParser.containsXmlToolCall("<function=")).toBe(true)
			expect(XmlToolCallParser.containsXmlToolCall("<function")).toBe(true)
			expect(XmlToolCallParser.containsXmlToolCall("<")).toBe(true)
		})

		it("should return false for non-tool-call content", () => {
			expect(XmlToolCallParser.containsXmlToolCall("regular text")).toBe(false)
			expect(XmlToolCallParser.containsXmlToolCall("some <html> tag")).toBe(false)
			expect(XmlToolCallParser.containsXmlToolCall("let x = 5 < 10")).toBe(false)
		})
	})

	describe("parseComplete", () => {
		it("should parse a simple tool call", () => {
			const text = `<function=read_file>
<parameter=path>src/main.ts</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.textContent.trim()).toBe("")
			expect(result.events).toHaveLength(3) // start, delta, end

			const startEvent = result.events.find((e) => e.type === "tool_call_start")
			expect(startEvent).toBeDefined()
			expect(startEvent!.type).toBe("tool_call_start")
			expect((startEvent as any).name).toBe("read_file")

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			expect(deltaEvent).toBeDefined()
			const deltaArgs = JSON.parse((deltaEvent as any).delta)
			expect(deltaArgs.path).toBe("src/main.ts")

			const endEvent = result.events.find((e) => e.type === "tool_call_end")
			expect(endEvent).toBeDefined()
		})

		it("should parse tool call with multiple parameters", () => {
			const text = `<function=edit_file>
<parameter=path>src/app.ts</parameter>
<parameter=old_string>const x = 1</parameter>
<parameter=new_string>const x = 2</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.events).toHaveLength(3)

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(args.path).toBe("src/app.ts")
			expect(args.old_string).toBe("const x = 1")
			expect(args.new_string).toBe("const x = 2")
		})

		it("should extract text before tool call", () => {
			const text = `Here is my analysis:

<function=read_file>
<parameter=path>test.txt</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.textContent.trim()).toBe("Here is my analysis:")
			expect(result.events).toHaveLength(3)
		})

		it("should handle attempt_completion correctly", () => {
			const text = `<function=attempt_completion>
<parameter=result>Task completed successfully. I have analyzed the code and found no issues.</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.events).toHaveLength(3)

			const startEvent = result.events.find((e) => e.type === "tool_call_start")
			expect((startEvent as any).name).toBe("attempt_completion")

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(args.result).toBe("Task completed successfully. I have analyzed the code and found no issues.")
		})

		it("should handle multiline parameter values", () => {
			const text = `<function=write_to_file>
<parameter=path>test.ts</parameter>
<parameter=content>function hello() {
  console.log("Hello, World!");
}
</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(args.path).toBe("test.ts")
			expect(args.content).toContain('console.log("Hello, World!")')
		})

		it("should pass through text without tool calls", () => {
			const text = "This is just regular text without any tool calls."

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.textContent).toBe(text)
			expect(result.events).toHaveLength(0)
		})
	})

	describe("streaming (processChunk)", () => {
		it("should handle tool call split across chunks", () => {
			const parser = new XmlToolCallParser()

			// Send chunks progressively - start with a recognizable partial pattern
			const result1 = parser.processChunk("<function=")
			expect(result1.events).toHaveLength(0)
			expect(result1.isPartialToolCall).toBe(true)

			const result2 = parser.processChunk("read_file>")
			expect(result2.events.some((e) => e.type === "tool_call_start")).toBe(true)

			const result3 = parser.processChunk("<parameter=path>test.ts</para")
			expect(result3.events).toHaveLength(0) // Still waiting for parameter end

			const result4 = parser.processChunk("meter></function>")
			// Should have delta and end events
			const allEvents = [...result4.events]
			expect(allEvents.some((e) => e.type === "tool_call_delta")).toBe(true)
			expect(allEvents.some((e) => e.type === "tool_call_end")).toBe(true)
		})

		it("should accumulate text before tool call in streaming", () => {
			const parser = new XmlToolCallParser()

			const result1 = parser.processChunk("Some text ")
			expect(result1.textContent).toBe("Some text ")
			expect(result1.events).toHaveLength(0)

			const result2 = parser.processChunk("before <function=read_file>")
			expect(result2.textContent).toBe("before ")
			expect(result2.events.some((e) => e.type === "tool_call_start")).toBe(true)
		})

		it("should finalize incomplete tool calls", () => {
			const parser = new XmlToolCallParser()

			parser.processChunk("<function=read_file>")
			parser.processChunk("<parameter=path>test.ts</parameter>")

			// Finalize without closing tag
			const finalResult = parser.finalize()

			// Should still emit delta and end events
			expect(finalResult.events.some((e) => e.type === "tool_call_delta")).toBe(true)
			expect(finalResult.events.some((e) => e.type === "tool_call_end")).toBe(true)
		})

		it("should reset state correctly", () => {
			const parser = new XmlToolCallParser()

			parser.processChunk("<function=read_file>")
			expect(parser.hasPendingContent()).toBe(true)

			parser.reset()
			expect(parser.hasPendingContent()).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should handle empty parameter values", () => {
			const text = `<function=read_file>
<parameter=path></parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(args.path).toBe("")
		})

		it("should handle parameter values with special characters", () => {
			const text = `<function=execute_command>
<parameter=command>echo "Hello <World>"</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(args.command).toBe('echo "Hello <World>"')
		})

		it("should generate unique tool call IDs", () => {
			const result1 = XmlToolCallParser.parseComplete(
				"<function=read_file><parameter=path>a.ts</parameter></function>",
			)
			const result2 = XmlToolCallParser.parseComplete(
				"<function=read_file><parameter=path>b.ts</parameter></function>",
			)

			const id1 = (result1.events.find((e) => e.type === "tool_call_start") as any).id
			const id2 = (result2.events.find((e) => e.type === "tool_call_start") as any).id

			expect(id1).not.toBe(id2)
			expect(id1).toMatch(/^xml_tool_/)
			expect(id2).toMatch(/^xml_tool_/)
		})

		it("should handle Qwen3-Coder-Next exact format", () => {
			// This is the exact format from the issue
			const text = `I am Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics. I can analyze code, explain concepts, and access external resources to help you with technical questions.

<function=attempt_completion>
<parameter=result>I am Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics. I can analyze code, explain concepts, and access external resources to help you with technical questions.</parameter>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.textContent.trim()).toContain("I am Roo, a knowledgeable technical assistant")
			expect(result.events).toHaveLength(3)

			const startEvent = result.events.find((e) => e.type === "tool_call_start")
			expect((startEvent as any).name).toBe("attempt_completion")

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(args.result).toContain("I am Roo, a knowledgeable technical assistant")
		})

		it("should handle tool calls with no parameters", () => {
			const text = `<function=list_files>
</function>`

			const result = XmlToolCallParser.parseComplete(text)

			expect(result.events).toHaveLength(3)

			const deltaEvent = result.events.find((e) => e.type === "tool_call_delta")
			const args = JSON.parse((deltaEvent as any).delta)
			expect(Object.keys(args)).toHaveLength(0)
		})
	})
})
