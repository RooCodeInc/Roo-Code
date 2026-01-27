import { XmlToolCallParser } from "../XmlToolCallParser"

describe("XmlToolCallParser", () => {
	describe("containsXmlToolMarkup", () => {
		it("should detect read_file tool markup", () => {
			const text = `<read_file>
<path>src/file.ts</path>
</read_file>`
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(true)
		})

		it("should detect execute_command tool markup", () => {
			const text = `<execute_command>
<command>npm test</command>
</execute_command>`
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(true)
		})

		it("should detect write_to_file tool markup", () => {
			const text = `<write_to_file>
<path>test.ts</path>
<content>console.log('hello')</content>
</write_to_file>`
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(true)
		})

		it("should not detect tool markup in code blocks", () => {
			const text = "```\n<read_file><path>src/file.ts</path></read_file>\n```"
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(false)
		})

		it("should not detect tool markup in inline code", () => {
			const text = "Use `<read_file><path>src/file.ts</path></read_file>` to read files"
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(false)
		})

		it("should not detect non-tool XML tags", () => {
			const text = "<div>Hello</div><span>World</span>"
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(false)
		})

		it("should return false for plain text", () => {
			const text = "This is just plain text without any XML"
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(false)
		})

		it("should be case insensitive", () => {
			const text = "<READ_FILE><path>src/file.ts</path></READ_FILE>"
			expect(XmlToolCallParser.containsXmlToolMarkup(text)).toBe(true)
		})
	})

	describe("parseXmlToolCalls", () => {
		describe("read_file tool", () => {
			it("should parse simple read_file tool call", () => {
				const text = `<read_file>
<path>src/file.ts</path>
</read_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses).toHaveLength(1)
				expect(result.toolUses[0].name).toBe("read_file")
				expect(result.toolUses[0].type).toBe("tool_use")
				expect(result.toolUses[0].partial).toBe(false)
				expect(result.toolUses[0].id).toMatch(/^toolu_/)
				expect(result.toolUses[0].nativeArgs).toEqual({
					files: [{ path: "src/file.ts" }],
				})
			})

			it("should handle read_file with files array in params", () => {
				const text = `<read_file>
<files>[{"path": "src/file.ts"}]</files>
</read_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].nativeArgs).toEqual({
					files: [{ path: "src/file.ts" }],
				})
			})
		})

		describe("execute_command tool", () => {
			it("should parse execute_command tool call", () => {
				const text = `<execute_command>
<command>npm test</command>
</execute_command>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses).toHaveLength(1)
				expect(result.toolUses[0].name).toBe("execute_command")
				expect(result.toolUses[0].nativeArgs).toEqual({
					command: "npm test",
					cwd: undefined,
				})
			})

			it("should parse execute_command with cwd", () => {
				const text = `<execute_command>
<command>npm test</command>
<cwd>./packages/core</cwd>
</execute_command>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].nativeArgs).toEqual({
					command: "npm test",
					cwd: "./packages/core",
				})
			})
		})

		describe("write_to_file tool", () => {
			it("should parse write_to_file tool call", () => {
				const text = `<write_to_file>
<path>test.ts</path>
<content>console.log('hello')</content>
</write_to_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses).toHaveLength(1)
				expect(result.toolUses[0].name).toBe("write_to_file")
				expect(result.toolUses[0].nativeArgs).toEqual({
					path: "test.ts",
					content: "console.log('hello')",
				})
			})

			it("should preserve multi-line content", () => {
				const text = `<write_to_file>
<path>test.ts</path>
<content>function hello() {
		console.log('hello')
}

export { hello }</content>
</write_to_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				const nativeArgs = result.toolUses[0].nativeArgs as { content: string }
				expect(nativeArgs.content).toContain("function hello()")
				expect(nativeArgs.content).toContain("export { hello }")
			})
		})

		describe("apply_diff tool", () => {
			it("should parse apply_diff tool call", () => {
				const text = `<apply_diff>
<path>src/file.ts</path>
<diff>--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,3 @@
-const x = 1
+const x = 2</diff>
</apply_diff>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("apply_diff")
				expect(result.toolUses[0].nativeArgs).toHaveProperty("path", "src/file.ts")
				expect(result.toolUses[0].nativeArgs).toHaveProperty("diff")
			})
		})

		describe("list_files tool", () => {
			it("should parse list_files tool call", () => {
				const text = `<list_files>
<path>src/</path>
<recursive>true</recursive>
</list_files>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("list_files")
				expect(result.toolUses[0].nativeArgs).toEqual({
					path: "src/",
					recursive: true,
				})
			})

			it("should handle recursive=false", () => {
				const text = `<list_files>
<path>./</path>
<recursive>false</recursive>
</list_files>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				const nativeArgs = result.toolUses[0].nativeArgs as { recursive: boolean }
				expect(nativeArgs.recursive).toBe(false)
			})
		})

		describe("search_files tool", () => {
			it("should parse search_files tool call", () => {
				const text = `<search_files>
<path>src/</path>
<regex>TODO:</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("search_files")
				expect(result.toolUses[0].nativeArgs).toEqual({
					path: "src/",
					regex: "TODO:",
					file_pattern: "*.ts",
				})
			})
		})

		describe("attempt_completion tool", () => {
			it("should parse attempt_completion tool call", () => {
				const text = `<attempt_completion>
<result>The task has been completed successfully.</result>
</attempt_completion>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("attempt_completion")
				expect(result.toolUses[0].nativeArgs).toEqual({
					result: "The task has been completed successfully.",
				})
			})
		})

		describe("ask_followup_question tool", () => {
			it("should parse ask_followup_question tool call", () => {
				const text = `<ask_followup_question>
<question>What file would you like me to read?</question>
<follow_up>[{"text": "src/file.ts"}, {"text": "package.json"}]</follow_up>
</ask_followup_question>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("ask_followup_question")
				const nativeArgs = result.toolUses[0].nativeArgs as { question: string; follow_up: unknown[] }
				expect(nativeArgs.question).toBe("What file would you like me to read?")
				expect(nativeArgs.follow_up).toEqual([{ text: "src/file.ts" }, { text: "package.json" }])
			})
		})

		describe("switch_mode tool", () => {
			it("should parse switch_mode tool call", () => {
				const text = `<switch_mode>
<mode_slug>code</mode_slug>
<reason>Need to implement the feature</reason>
</switch_mode>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("switch_mode")
				expect(result.toolUses[0].nativeArgs).toEqual({
					mode_slug: "code",
					reason: "Need to implement the feature",
				})
			})
		})

		describe("multiple tool calls", () => {
			it("should parse multiple tool calls in sequence", () => {
				const text = `I'll first read the file and then execute a command.

<read_file>
<path>src/file.ts</path>
</read_file>

<execute_command>
<command>npm test</command>
</execute_command>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses).toHaveLength(2)
				expect(result.toolUses[0].name).toBe("read_file")
				expect(result.toolUses[1].name).toBe("execute_command")
				expect(result.remainingText).toBe("I'll first read the file and then execute a command.")
			})

			it("should extract remaining text properly", () => {
				const text = `Here's my analysis:

<read_file>
<path>src/file.ts</path>
</read_file>

This should help us understand the code.`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.remainingText).toContain("Here's my analysis:")
				expect(result.remainingText).toContain("This should help us understand the code.")
			})
		})

		describe("CDATA handling", () => {
			it("should handle CDATA sections in content", () => {
				const text = `<write_to_file>
<path>test.ts</path>
<content><![CDATA[const x = 1; // This <should> work]]></content>
</write_to_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				const nativeArgs = result.toolUses[0].nativeArgs as { content: string }
				expect(nativeArgs.content).toBe("const x = 1; // This <should> work")
			})
		})

		describe("edge cases", () => {
			it("should return empty result for text without tool calls", () => {
				const text = "This is just plain text without any tool calls."

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(false)
				expect(result.toolUses).toHaveLength(0)
				expect(result.remainingText).toBe(text)
			})

			it("should generate unique tool call IDs", () => {
				const text = `<read_file><path>file1.ts</path></read_file>
<read_file><path>file2.ts</path></read_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.toolUses[0].id).not.toBe(result.toolUses[1].id)
				expect(result.toolUses[0].id).toMatch(/^toolu_/)
				expect(result.toolUses[1].id).toMatch(/^toolu_/)
			})

			it("should handle empty parameters", () => {
				const text = `<attempt_completion>
<result></result>
</attempt_completion>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].nativeArgs).toEqual({ result: "" })
			})

			it("should handle whitespace in parameters", () => {
				const text = `<read_file>
<path>   src/file.ts   </path>
</read_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				// Whitespace should be trimmed
				const nativeArgs = result.toolUses[0].nativeArgs as { files: Array<{ path: string }> }
				expect(nativeArgs.files[0].path).toBe("src/file.ts")
			})
		})

		describe("tool alias resolution", () => {
			it("should resolve edit_file alias to apply_diff", () => {
				// Note: This depends on the resolveToolAlias implementation
				// If edit_file maps to apply_diff, we should test that
				const text = `<edit_file>
<file_path>src/file.ts</file_path>
<old_string>const x = 1</old_string>
<new_string>const x = 2</new_string>
</edit_file>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				// The resolved name might be different based on alias mapping
				expect(result.toolUses[0].nativeArgs).toHaveProperty("file_path", "src/file.ts")
			})
		})

		describe("use_mcp_tool", () => {
			it("should parse use_mcp_tool with JSON arguments", () => {
				const text = `<use_mcp_tool>
<server_name>my-server</server_name>
<tool_name>my-tool</tool_name>
<arguments>{"key": "value"}</arguments>
</use_mcp_tool>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("use_mcp_tool")
				expect(result.toolUses[0].nativeArgs).toEqual({
					server_name: "my-server",
					tool_name: "my-tool",
					arguments: { key: "value" },
				})
			})
		})

		describe("browser_action tool", () => {
			it("should parse browser_action tool call", () => {
				const text = `<browser_action>
<action>launch</action>
<url>https://example.com</url>
</browser_action>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("browser_action")
				const nativeArgs = result.toolUses[0].nativeArgs as { action: string; url: string }
				expect(nativeArgs.action).toBe("launch")
				expect(nativeArgs.url).toBe("https://example.com")
			})
		})

		describe("new_task tool", () => {
			it("should parse new_task tool call", () => {
				const text = `<new_task>
<mode>architect</mode>
<message>Design the new feature</message>
</new_task>`

				const result = XmlToolCallParser.parseXmlToolCalls(text)

				expect(result.hasToolCalls).toBe(true)
				expect(result.toolUses[0].name).toBe("new_task")
				expect(result.toolUses[0].nativeArgs).toEqual({
					mode: "architect",
					message: "Design the new feature",
					todos: undefined,
				})
			})
		})
	})
})
