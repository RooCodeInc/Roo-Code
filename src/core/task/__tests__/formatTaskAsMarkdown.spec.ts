import { describe, it, expect } from "vitest"
import type { ClineMessage } from "@roo-code/types"
import { formatTaskAsMarkdown } from "../formatTaskAsMarkdown"

describe("formatTaskAsMarkdown", () => {
	it("should return empty string for empty messages array", () => {
		const result = formatTaskAsMarkdown([])
		expect(result).toBe("")
	})

	it("should return empty string for null/undefined messages", () => {
		expect(formatTaskAsMarkdown(null as any)).toBe("")
		expect(formatTaskAsMarkdown(undefined as any)).toBe("")
	})

	it("should format user feedback messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "user_feedback",
				text: "Hello, can you help me?",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Human")
		expect(result).toContain("Hello, can you help me?")
	})

	it("should format assistant text messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "text",
				text: "Sure, I can help you with that.",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Assistant")
		expect(result).toContain("Sure, I can help you with that.")
	})

	it("should format error messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "error",
				text: "An error occurred",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Error")
		expect(result).toContain("```\nAn error occurred\n```")
	})

	it("should format completion result messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "completion_result",
				text: "Task completed successfully!",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Task Completed")
		expect(result).toContain("Task completed successfully!")
	})

	it("should format reasoning messages with blockquote", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "reasoning",
				text: "I need to analyze this\nStep by step",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Reasoning")
		expect(result).toContain("> I need to analyze this\n> Step by step")
	})

	it("should format command execution messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "command",
				text: "npm install",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Command Execution")
		expect(result).toContain("```bash\nnpm install\n```")
	})

	it("should format tool use messages for file operations", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "readFile",
					path: "src/index.ts",
				}),
			},
			{
				ts: 1001,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "newFileCreated",
					path: "src/new.ts",
					content: "const x = 1;",
				}),
			},
			{
				ts: 1002,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "editedExistingFile",
					path: "src/existing.ts",
					diff: "- old line\n+ new line",
				}),
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Reading File")
		expect(result).toContain("**Path:** `src/index.ts`")
		expect(result).toContain("## Creating File")
		expect(result).toContain("**Path:** `src/new.ts`")
		expect(result).toContain("## Editing File")
		expect(result).toContain("```diff\n- old line\n+ new line\n```")
	})

	it("should format updateTodoList tool messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "updateTodoList",
					todos: ["- [ ] Task 1", "- [x] Task 2", "- [ ] Task 3"],
				}),
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Updated TODO List")
		expect(result).toContain("- [ ] Task 1")
		expect(result).toContain("- [x] Task 2")
		expect(result).toContain("- [ ] Task 3")
	})

	it("should format follow-up questions", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "followup",
				text: JSON.stringify({
					question: "Which framework would you like to use?",
					suggest: ["React", "Vue", "Angular"],
				}),
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Question")
		expect(result).toContain("Which framework would you like to use?")
	})

	it("should handle messages with images", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "user_feedback",
				text: "Here's a screenshot",
				images: ["data:image/png;base64,abc123", "data:image/png;base64,def456"],
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Human")
		expect(result).toContain("Here's a screenshot")
		expect(result).toContain("*[2 image(s) attached]*")
	})

	it("should separate multiple messages with dividers", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "user_feedback",
				text: "First message",
			},
			{
				ts: 1001,
				type: "say",
				say: "text",
				text: "Second message",
			},
			{
				ts: 1002,
				type: "say",
				say: "user_feedback",
				text: "Third message",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain(
			"## Human\n\nFirst message\n\n---\n\n## Assistant\n\nSecond message\n\n---\n\n## Human\n\nThird message",
		)
	})

	it("should skip api_req_started and api_req_finished messages", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "api_req_started",
				text: '{"cost": 0.01}',
			},
			{
				ts: 1001,
				type: "say",
				say: "api_req_finished",
				text: "finished",
			},
			{
				ts: 1002,
				type: "say",
				say: "text",
				text: "Actual content",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).not.toContain("api_req_started")
		expect(result).not.toContain("api_req_finished")
		expect(result).toContain("## Assistant")
		expect(result).toContain("Actual content")
	})

	it("should format file listing operations", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "listFilesTopLevel",
					path: "/src",
					content: "file1.ts\nfile2.ts",
				}),
			},
			{
				ts: 1001,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "listFilesRecursive",
					path: "/src",
					content: "src/\n  file1.ts\n  subfolder/\n    file2.ts",
				}),
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Listing Files")
		expect(result).toContain("## Listing Files (Recursive)")
		expect(result).toContain("**Path:** `/src`")
	})

	it("should format search operations", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "searchFiles",
					regex: "TODO",
					path: "/src",
					content: "Found 3 matches",
				}),
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Searching Files")
		expect(result).toContain("**Pattern:** `TODO`")
		expect(result).toContain("**Path:** `/src`")
		expect(result).toContain("```\nFound 3 matches\n```")
	})

	it("should format mode switch operations", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "tool",
				text: JSON.stringify({
					tool: "switchMode",
					mode: "architect",
					reason: "Need to plan the architecture first",
				}),
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## Switching Mode")
		expect(result).toContain("**Mode:** architect")
		expect(result).toContain("**Reason:** Need to plan the architecture first")
	})

	it("should handle malformed JSON gracefully", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "ask",
				ask: "tool",
				text: "{ invalid json }",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		// Should not throw and should return empty for this message
		expect(result).toBe("")
	})

	it("should handle unknown message types with generic formatting", () => {
		const messages: ClineMessage[] = [
			{
				ts: 1000,
				type: "say",
				say: "unknown_type" as any,
				text: "Some unknown content",
			},
		]
		const result = formatTaskAsMarkdown(messages)
		expect(result).toContain("## unknown_type")
		expect(result).toContain("Some unknown content")
	})
})
