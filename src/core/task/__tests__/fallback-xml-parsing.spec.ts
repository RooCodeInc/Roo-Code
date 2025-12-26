// npx vitest run src/core/task/__tests__/fallback-xml-parsing.spec.ts

import { describe, it, expect } from "vitest"
import { AssistantMessageParser } from "../../assistant-message/AssistantMessageParser"
import { toolNames } from "@roo-code/types"
import { ToolUse, TextContent } from "../../../shared/tools"

/**
 * Tests for the fallback XML parsing mechanism that handles cases where
 * a model configured for native tool calling protocol outputs XML-style
 * tool tags instead of using native tool calls.
 *
 * This addresses Issue #10106: "Unknown API Error" / "Model Response Incomplete"
 * errors caused by protocol mismatch.
 *
 * @see https://github.com/RooCodeInc/Roo-Code/issues/10106
 */
describe("Fallback XML Parsing for Native Protocol", () => {
	describe("XML Tool Tag Detection", () => {
		it("should detect XML tool tags using the toolNames array", () => {
			// This pattern matches the one used in Task.ts for fallback detection
			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")

			// Test various tool names from the toolNames array
			expect(xmlToolTagPattern.test("<read_file>")).toBe(true)
			expect(xmlToolTagPattern.test("<write_to_file>")).toBe(true)
			expect(xmlToolTagPattern.test("<execute_command>")).toBe(true)
			expect(xmlToolTagPattern.test("<attempt_completion>")).toBe(true)
			expect(xmlToolTagPattern.test("<update_todo_list>")).toBe(true)
			expect(xmlToolTagPattern.test("<apply_diff>")).toBe(true)
			expect(xmlToolTagPattern.test("<search_files>")).toBe(true)
			expect(xmlToolTagPattern.test("<list_files>")).toBe(true)
			expect(xmlToolTagPattern.test("<browser_action>")).toBe(true)
			expect(xmlToolTagPattern.test("<ask_followup_question>")).toBe(true)
		})

		it("should not match non-tool tags", () => {
			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")

			expect(xmlToolTagPattern.test("<div>")).toBe(false)
			expect(xmlToolTagPattern.test("<span>")).toBe(false)
			expect(xmlToolTagPattern.test("<code>")).toBe(false)
			expect(xmlToolTagPattern.test("<random_tag>")).toBe(false)
			expect(xmlToolTagPattern.test("<not_a_tool>")).toBe(false)
		})

		it("should detect XML tool tags in assistant message with surrounding text", () => {
			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")

			const messageWithToolTag = `I'll read the file now.

<read_file>
<path>src/index.ts</path>
</read_file>

Let me analyze the content.`

			expect(xmlToolTagPattern.test(messageWithToolTag)).toBe(true)
		})

		it("should detect multiple tool tags in a single message", () => {
			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")

			const messageWithMultipleTools = `<update_todo_list>
<updates>
<update><index>1</index><status>Completed</status></update>
</updates>
</update_todo_list>

<attempt_completion>
<result>Task completed successfully.</result>
</attempt_completion>`

			expect(xmlToolTagPattern.test(messageWithMultipleTools)).toBe(true)
		})
	})

	describe("AssistantMessageParser Fallback Parsing", () => {
		it("should parse a single XML tool call from assistant message", () => {
			const parser = new AssistantMessageParser()
			const assistantMessage = `I'll read the file for you.

<read_file>
<path>src/index.ts</path>
</read_file>`

			parser.processChunk(assistantMessage)
			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()

			// Should have text + tool_use blocks
			const toolUses = blocks.filter((b) => b.type === "tool_use")
			expect(toolUses.length).toBe(1)

			const toolUse = toolUses[0] as ToolUse
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/index.ts")
		})

		it("should parse multiple XML tool calls from assistant message", () => {
			const parser = new AssistantMessageParser()

			// This is the exact pattern from the bug report in Issue #10106
			const assistantMessage = `I'll update the todo list and complete the task properly.

<update_todo_list>
<updates>
<update>
<index>10</index>
<content>Create integration test plan</content>
<status>Completed</status>
</update>
<update>
<index>11</index>
<content>Document the POC implementation</content>
<status>Completed</status>
</update>
</updates>
</update_todo_list>

<attempt_completion>
<result>
POC implementation completed successfully.
</result>
</attempt_completion>`

			parser.processChunk(assistantMessage)
			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()

			const toolUses = blocks.filter((b) => b.type === "tool_use")
			expect(toolUses.length).toBe(2)

			const updateTodo = toolUses[0] as ToolUse
			expect(updateTodo.name).toBe("update_todo_list")
			// The updates param is parsed as raw string content
			expect(Object.keys(updateTodo.params).length).toBeGreaterThan(0)

			const attemptCompletion = toolUses[1] as ToolUse
			expect(attemptCompletion.name).toBe("attempt_completion")
			expect(attemptCompletion.params.result).toBeDefined()
		})

		it("should parse write_to_file tool with multiline content", () => {
			const parser = new AssistantMessageParser()
			const assistantMessage = `<write_to_file>
<path>src/example.ts</path>
<content>
export function hello() {
  console.log("Hello, world!");
}
</content>
</write_to_file>`

			parser.processChunk(assistantMessage)
			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()

			const toolUses = blocks.filter((b) => b.type === "tool_use")
			expect(toolUses.length).toBe(1)

			const writeFile = toolUses[0] as ToolUse
			expect(writeFile.name).toBe("write_to_file")
			expect(writeFile.params.path).toBe("src/example.ts")
			expect(writeFile.params.content).toContain("export function hello()")
			expect(writeFile.params.content).toContain('console.log("Hello, world!")')
		})

		it("should parse execute_command tool", () => {
			const parser = new AssistantMessageParser()
			const assistantMessage = `Let me run the tests.

<execute_command>
<command>npm test</command>
<cwd>/path/to/project</cwd>
</execute_command>`

			parser.processChunk(assistantMessage)
			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()

			const toolUses = blocks.filter((b) => b.type === "tool_use")
			expect(toolUses.length).toBe(1)

			const executeCmd = toolUses[0] as ToolUse
			expect(executeCmd.name).toBe("execute_command")
			expect(executeCmd.params.command).toBe("npm test")
			expect(executeCmd.params.cwd).toBe("/path/to/project")
		})

		it("should preserve text content alongside parsed tool uses", () => {
			const parser = new AssistantMessageParser()
			const assistantMessage = `I'll analyze the code.

<read_file>
<path>src/main.ts</path>
</read_file>

After reviewing, I'll make some changes.`

			parser.processChunk(assistantMessage)
			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()

			const textBlocks = blocks.filter((b) => b.type === "text")
			const toolUses = blocks.filter((b) => b.type === "tool_use")

			expect(textBlocks.length).toBeGreaterThan(0)
			expect(toolUses.length).toBe(1)

			// Verify text content is preserved
			const textContents = textBlocks.map((b) => (b as TextContent).content).join("")
			expect(textContents).toContain("I'll analyze the code")
		})
	})

	describe("Fallback Trigger Conditions", () => {
		it("should identify when fallback is needed (no native tool calls, has XML tags)", () => {
			const assistantMessageContent: any[] = [{ type: "text", content: "Some text response with XML tool tags" }]

			const assistantMessage = `<read_file>
<path>test.ts</path>
</read_file>`

			// Check conditions for fallback (logic from Task.ts)
			const hasNativeToolCalls = assistantMessageContent.some(
				(block) => block.type === "tool_use" || block.type === "mcp_tool_use",
			)

			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")
			const containsXmlToolTags = xmlToolTagPattern.test(assistantMessage)

			expect(hasNativeToolCalls).toBe(false)
			expect(containsXmlToolTags).toBe(true)
			// Fallback should be triggered
			expect(!hasNativeToolCalls && containsXmlToolTags).toBe(true)
		})

		it("should not trigger fallback when native tool calls are present", () => {
			const assistantMessageContent: any[] = [
				{ type: "text", content: "Some text" },
				{
					type: "tool_use",
					id: "toolu_123",
					name: "read_file",
					params: { path: "test.ts" },
				},
			]

			const hasNativeToolCalls = assistantMessageContent.some(
				(block) => block.type === "tool_use" || block.type === "mcp_tool_use",
			)

			expect(hasNativeToolCalls).toBe(true)
			// Fallback should NOT be triggered
		})

		it("should not trigger fallback when message has no XML tool tags", () => {
			const assistantMessage = "This is just a regular text response without any tool calls."

			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")
			const containsXmlToolTags = xmlToolTagPattern.test(assistantMessage)

			expect(containsXmlToolTags).toBe(false)
			// Fallback should NOT be triggered
		})
	})

	describe("Real-world Bug Scenarios from Issue #10106", () => {
		it("should handle the exact error case from the bug report", () => {
			// This is the exact message format that was causing "Model Response Incomplete" errors
			const bugReportMessage = `I'll update the todo list and complete the task properly.

<update_todo_list>
<updates>
<update>
<index>10</index>
<content>Create integration test plan</content>
<status>Completed</status>
</update>
<update>
<index>11</index>
<content>Document the POC implementation</content>
<status>Completed</status>
</update>
</updates>
</update_todo_list>

<attempt_completion>
<result>
POC implementation completed successfully with the following components:
1. Core infrastructure
2. Integration tests
3. Documentation
</result>
</attempt_completion>`

			// Simulate the fallback detection
			const assistantMessageContent: any[] = [] // Empty - no native tool calls
			const hasNativeToolCalls = assistantMessageContent.some(
				(block) => block.type === "tool_use" || block.type === "mcp_tool_use",
			)

			const xmlToolTagPattern = new RegExp(`<(${toolNames.join("|")})>`, "i")
			const containsXmlToolTags = xmlToolTagPattern.test(bugReportMessage)

			// Verify fallback would be triggered
			expect(hasNativeToolCalls).toBe(false)
			expect(containsXmlToolTags).toBe(true)

			// Now verify the parser can extract the tools
			const parser = new AssistantMessageParser()
			parser.processChunk(bugReportMessage)
			parser.finalizeContentBlocks()
			const parsedBlocks = parser.getContentBlocks()

			const parsedToolUses = parsedBlocks.filter((block) => block.type === "tool_use")
			expect(parsedToolUses.length).toBe(2)

			// Verify the tools are correctly identified
			expect((parsedToolUses[0] as ToolUse).name).toBe("update_todo_list")
			expect((parsedToolUses[1] as ToolUse).name).toBe("attempt_completion")
		})
	})
})
