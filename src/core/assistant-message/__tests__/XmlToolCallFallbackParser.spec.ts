import { parseXmlToolCalls } from "../XmlToolCallFallbackParser"

describe("XmlToolCallFallbackParser", () => {
	describe("parseXmlToolCalls", () => {
		it("should return empty result for empty text", () => {
			expect(parseXmlToolCalls("").found).toBe(false)
			expect(parseXmlToolCalls("").toolUses).toEqual([])
		})

		it("should return empty result for text with no tool calls", () => {
			const text = "I'll help you with that task. Let me think about the best approach."
			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(false)
			expect(result.toolUses).toEqual([])
		})

		it("should parse a single read_file tool call", () => {
			const text = `Let me read the file first.

<read_file>
<path>src/main.ts</path>
</read_file>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].type).toBe("tool_use")
			expect(result.toolUses[0].name).toBe("read_file")
			expect(result.toolUses[0].params.path).toBe("src/main.ts")
			expect(result.toolUses[0].partial).toBe(false)
			expect(result.toolUses[0].usedLegacyFormat).toBe(true)
		})

		it("should parse a write_to_file tool call with multi-line content", () => {
			const text = `<write_to_file>
<path>src/hello.ts</path>
<content>export function hello() {
  console.log("hello world")
}
</content>
</write_to_file>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("write_to_file")
			expect(result.toolUses[0].params.path).toBe("src/hello.ts")
			expect(result.toolUses[0].params.content).toContain("hello world")
		})

		it("should parse multiple tool calls in a single response", () => {
			const text = `I'll read both files.

<read_file>
<path>src/a.ts</path>
</read_file>

Now let me also check the other file.

<read_file>
<path>src/b.ts</path>
</read_file>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(2)
			expect(result.toolUses[0].params.path).toBe("src/a.ts")
			expect(result.toolUses[1].params.path).toBe("src/b.ts")
		})

		it("should parse execute_command tool call", () => {
			const text = `<execute_command>
<command>npm test</command>
</execute_command>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("execute_command")
			expect(result.toolUses[0].params.command).toBe("npm test")
		})

		it("should parse search_files tool call with multiple params", () => {
			const text = `<search_files>
<path>src</path>
<regex>function\\s+\\w+</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("search_files")
			expect(result.toolUses[0].params.path).toBe("src")
			expect(result.toolUses[0].params.regex).toBe("function\\s+\\w+")
			expect(result.toolUses[0].params.file_pattern).toBe("*.ts")
		})

		it("should parse list_files tool call", () => {
			const text = `<list_files>
<path>src</path>
<recursive>true</recursive>
</list_files>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("list_files")
			expect(result.toolUses[0].params.path).toBe("src")
			expect(result.toolUses[0].params.recursive).toBe("true")
		})

		it("should parse attempt_completion tool call", () => {
			const text = `<attempt_completion>
<result>I've completed the task successfully.</result>
</attempt_completion>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("attempt_completion")
			expect(result.toolUses[0].params.result).toBe("I've completed the task successfully.")
		})

		it("should parse apply_diff tool call with multi-line diff content", () => {
			const text = `<apply_diff>
<path>src/main.ts</path>
<diff><<<<<<< SEARCH
:start_line:1
-------
old content
=======
new content
>>>>>>> REPLACE</diff>
</apply_diff>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("apply_diff")
			expect(result.toolUses[0].params.path).toBe("src/main.ts")
			expect(result.toolUses[0].params.diff).toContain("SEARCH")
			expect(result.toolUses[0].params.diff).toContain("REPLACE")
		})

		it("should handle tool aliases (write_file -> write_to_file)", () => {
			const text = `<write_file>
<path>src/test.ts</path>
<content>test content</content>
</write_file>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("write_to_file")
			expect(result.toolUses[0].originalName).toBe("write_file")
		})

		it("should not match non-tool XML tags", () => {
			const text = `<environment_details>
VS Code version: 1.107.1
</environment_details>

<thinking>
Let me analyze the situation.
</thinking>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(false)
			expect(result.toolUses).toEqual([])
		})

		it("should handle tool calls inline with surrounding text", () => {
			const text = `First, I'll check the directory. <list_files><path>.</path><recursive>false</recursive></list_files> That should give us what we need.`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("list_files")
			expect(result.toolUses[0].params.path).toBe(".")
		})

		it("should generate unique IDs for each tool call", () => {
			const text = `<read_file><path>a.ts</path></read_file>
<read_file><path>b.ts</path></read_file>`

			const result = parseXmlToolCalls(text)
			expect(result.toolUses).toHaveLength(2)
			expect(result.toolUses[0].id).not.toBe(result.toolUses[1].id)
		})

		it("should parse ask_followup_question tool call", () => {
			const text = `<ask_followup_question>
<question>Which file would you like me to modify?</question>
</ask_followup_question>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("ask_followup_question")
			expect(result.toolUses[0].params.question).toBe("Which file would you like me to modify?")
		})

		it("should parse switch_mode tool call", () => {
			const text = `<switch_mode>
<mode_slug>architect</mode_slug>
<reason>Need to design the solution first</reason>
</switch_mode>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("switch_mode")
			expect(result.toolUses[0].params.mode_slug).toBe("architect")
			expect(result.toolUses[0].params.reason).toBe("Need to design the solution first")
		})

		it("should parse new_task tool call", () => {
			const text = `<new_task>
<mode>code</mode>
<message>Implement the feature</message>
</new_task>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("new_task")
			expect(result.toolUses[0].params.mode).toBe("code")
			expect(result.toolUses[0].params.message).toBe("Implement the feature")
		})

		it("should parse use_mcp_tool tool call", () => {
			const text = `<use_mcp_tool>
<server_name>my-server</server_name>
<tool_name>my-tool</tool_name>
<arguments>{"key": "value"}</arguments>
</use_mcp_tool>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("use_mcp_tool")
			expect(result.toolUses[0].params.server_name).toBe("my-server")
			expect(result.toolUses[0].params.tool_name).toBe("my-tool")
			expect(result.toolUses[0].params.arguments).toBe('{"key": "value"}')
		})

		it("should ignore unknown parameter names within tool calls", () => {
			const text = `<read_file>
<path>test.ts</path>
<unknown_param>should be ignored</unknown_param>
</read_file>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].params.path).toBe("test.ts")
			expect(Object.keys(result.toolUses[0].params)).toHaveLength(1)
		})

		it("should handle whitespace in parameter values", () => {
			const text = `<read_file>
<path>  src/main.ts  </path>
</read_file>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			// Whitespace in params is preserved as-is (tool handlers may trim)
			expect(result.toolUses[0].params.path).toBe("  src/main.ts  ")
		})

		it("should handle execute_command with cwd parameter", () => {
			const text = `<execute_command>
<command>ls -la</command>
<cwd>/home/user/project</cwd>
</execute_command>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses[0].name).toBe("execute_command")
			expect(result.toolUses[0].params.command).toBe("ls -la")
			expect(result.toolUses[0].params.cwd).toBe("/home/user/project")
		})

		it("should handle null/undefined input gracefully", () => {
			expect(parseXmlToolCalls(null as unknown as string).found).toBe(false)
			expect(parseXmlToolCalls(undefined as unknown as string).found).toBe(false)
		})

		it("should handle codebase_search tool call", () => {
			const text = `<codebase_search>
<query>authentication middleware</query>
<path>src</path>
</codebase_search>`

			const result = parseXmlToolCalls(text)
			expect(result.found).toBe(true)
			expect(result.toolUses).toHaveLength(1)
			expect(result.toolUses[0].name).toBe("codebase_search")
			expect(result.toolUses[0].params.query).toBe("authentication middleware")
			expect(result.toolUses[0].params.path).toBe("src")
		})
	})
})
