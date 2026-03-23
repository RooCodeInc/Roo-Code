import { generateXmlToolCatalog } from "../xml-tool-catalog"
import type OpenAI from "openai"

describe("generateXmlToolCatalog", () => {
	it("should return empty string for empty tools array", () => {
		expect(generateXmlToolCatalog([])).toBe("")
	})

	it("should generate catalog with tool name, description, and parameters", () => {
		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "read_file",
					description: "Read a file from the filesystem.",
					parameters: {
						type: "object",
						properties: {
							path: {
								type: "string",
								description: "Path to the file",
							},
						},
						required: ["path"],
					},
				},
			},
		]

		const result = generateXmlToolCatalog(tools)

		expect(result).toContain("# Tools")
		expect(result).toContain("## read_file")
		expect(result).toContain("Read a file from the filesystem.")
		expect(result).toContain("<read_file>")
		expect(result).toContain("(required)")
		expect(result).toContain("</read_file>")
	})

	it("should mark optional parameters correctly", () => {
		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "list_files",
					description: "List files in a directory.",
					parameters: {
						type: "object",
						properties: {
							path: { type: "string", description: "Directory path" },
							recursive: { type: "boolean", description: "Whether to recurse" },
						},
						required: ["path"],
					},
				},
			},
		]

		const result = generateXmlToolCatalog(tools)

		expect(result).toContain("(required)")
		expect(result).toContain("(optional)")
	})

	it("should handle multiple tools", () => {
		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "read_file",
					description: "Read a file.",
					parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
				},
			},
			{
				type: "function",
				function: {
					name: "write_to_file",
					description: "Write to a file.",
					parameters: {
						type: "object",
						properties: {
							path: { type: "string" },
							content: { type: "string" },
						},
						required: ["path", "content"],
					},
				},
			},
		]

		const result = generateXmlToolCatalog(tools)

		expect(result).toContain("## read_file")
		expect(result).toContain("## write_to_file")
		expect(result).toContain("<write_to_file>")
		expect(result).toContain("</write_to_file>")
	})

	it("should handle tools with no parameters", () => {
		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "some_tool",
					description: "A tool with no params.",
					parameters: { type: "object", properties: {} },
				},
			},
		]

		const result = generateXmlToolCatalog(tools)

		expect(result).toContain("## some_tool")
		expect(result).toContain("<some_tool>")
		expect(result).toContain("</some_tool>")
	})

	it("should use hand-crafted descriptions for attempt_completion", () => {
		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "attempt_completion",
					description: "Auto-generated description",
					parameters: { type: "object", properties: { result: { type: "string" } }, required: ["result"] },
				},
			},
		]

		const result = generateXmlToolCatalog(tools)

		// Should use hand-crafted description, not auto-generated
		expect(result).toContain("IMPORTANT NOTE")
		expect(result).toContain("<result>")
	})

	it("should use hand-crafted descriptions for ask_followup_question", () => {
		const tools: OpenAI.Chat.ChatCompletionTool[] = [
			{
				type: "function",
				function: {
					name: "ask_followup_question",
					description: "Auto-generated description",
					parameters: {
						type: "object",
						properties: { question: { type: "string" }, follow_up: { type: "string" } },
						required: ["question"],
					},
				},
			},
		]

		const result = generateXmlToolCatalog(tools)

		// Should use hand-crafted description with <suggest> tags
		expect(result).toContain("<suggest>")
		expect(result).toContain("<follow_up>")
	})
})
