// npx vitest src/core/assistant-message/__tests__/presentAssistantMessage.spec.ts

import { ToolUse } from "../../../shared/tools"

// Mock the removeClosingTag function to test it in isolation
// We'll extract the logic from presentAssistantMessage for testing
function createRemoveClosingTagFunction(block: ToolUse) {
	return (tag: string, text?: string): string => {
		if (!text) {
			return ""
		}

		let cleanedText = text

		// For MCP tools, some models incorrectly add complete closing tags
		// like "</use_mcp_tool>" to the tool parameters. Remove these first.
		if (block.name === "use_mcp_tool" || block.name === "access_mcp_resource") {
			// Remove complete erroneous closing tags for MCP tools
			// This handles both single and multiple occurrences, and also handles cases
			// where partial tags might follow complete tags
			cleanedText = cleanedText.replace(/<\/use_mcp_tool>/g, "").trimEnd()
			cleanedText = cleanedText.replace(/<\/access_mcp_resource>/g, "").trimEnd()
		}

		// Handle partial closing tags during streaming (original logic)
		if (block.partial) {
			// This regex dynamically constructs a pattern to match the
			// closing tag:
			// - Optionally matches whitespace before the tag.
			// - Matches '<' or '</' optionally followed by any subset of
			//   characters from the tag name.
			const tagRegex = new RegExp(
				`\\s?<\/?${tag
					.split("")
					.map((char) => `(?:${char})?`)
					.join("")}$`,
				"g",
			)

			cleanedText = cleanedText.replace(tagRegex, "")
		}

		return cleanedText
	}
}

describe("removeClosingTag function", () => {
	describe("MCP tool erroneous closing tag removal", () => {
		it("should remove complete </use_mcp_tool> closing tags from use_mcp_tool parameters", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}</use_mcp_tool>',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("arguments", block.params.arguments)

			expect(result).toBe('{"param": "value"}')
		})

		it("should remove complete </use_mcp_tool> closing tags with whitespace", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}</use_mcp_tool>   ',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("arguments", block.params.arguments)

			expect(result).toBe('{"param": "value"}')
		})

		it("should remove complete </access_mcp_resource> closing tags from access_mcp_resource parameters", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "access_mcp_resource",
				params: {
					server_name: "test_server",
					uri: "file://test.txt</access_mcp_resource>",
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("uri", block.params.uri)

			expect(result).toBe("file://test.txt")
		})

		it("should not remove closing tags from non-MCP tools", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {
					path: "test.txt</use_mcp_tool>",
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("path", block.params.path)

			// Should not remove the closing tag since this is not an MCP tool
			expect(result).toBe("test.txt</use_mcp_tool>")
		})

		it("should handle multiple erroneous closing tags", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					arguments: '{"param": "value"}</use_mcp_tool></use_mcp_tool>',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("arguments", block.params.arguments)

			// Should remove both erroneous closing tags
			expect(result).toBe('{"param": "value"}')
		})

		it("should not remove closing tags that are part of legitimate content", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					arguments: '{"html": "<div>content</div>", "tool": "use_mcp_tool"}',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("arguments", block.params.arguments)

			// Should not remove legitimate HTML tags or tool names in content
			expect(result).toBe('{"html": "<div>content</div>", "tool": "use_mcp_tool"}')
		})
	})

	describe("partial closing tag removal during streaming", () => {
		it("should remove partial closing tags when block is partial", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {
					path: "test.txt</pa",
				},
				partial: true,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("path", block.params.path)

			expect(result).toBe("test.txt")
		})

		it("should remove partial opening tags when block is partial", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {
					path: "test.txt<pa",
				},
				partial: true,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("path", block.params.path)

			expect(result).toBe("test.txt")
		})

		it("should not remove partial tags when block is not partial", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {
					path: "test.txt</pa",
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("path", block.params.path)

			// Should not remove partial tags when block is complete
			expect(result).toBe("test.txt</pa")
		})
	})

	describe("combined scenarios", () => {
		it("should handle both erroneous closing tags and partial tags for MCP tools", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					arguments: '{"param": "value"}</use_mcp_tool></arg',
				},
				partial: true,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("arguments", block.params.arguments)

			// Should remove both the erroneous closing tag and the partial tag
			expect(result).toBe('{"param": "value"}')
		})

		it("should handle empty or undefined text", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)

			expect(removeClosingTag("arguments", undefined)).toBe("")
			expect(removeClosingTag("arguments", "")).toBe("")
		})

		it("should handle text without any tags", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const result = removeClosingTag("arguments", block.params.arguments)

			// Should return text unchanged when no erroneous tags are present
			expect(result).toBe('{"param": "value"}')
		})
	})

	describe("qwen2.5-72b-instruct specific scenarios", () => {
		it("should handle the exact issue reported with qwen2.5-72b-instruct model", () => {
			// This test simulates the exact scenario described in issue #5464
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "filesystem",
					tool_name: "read_file",
					arguments: '{"path": "/path/to/file.txt"}</use_mcp_tool>',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const cleanedArguments = removeClosingTag("arguments", block.params.arguments)

			// The cleaned arguments should be valid JSON without the erroneous closing tag
			expect(cleanedArguments).toBe('{"path": "/path/to/file.txt"}')

			// Verify that the cleaned arguments can be parsed as valid JSON
			expect(() => JSON.parse(cleanedArguments)).not.toThrow()

			const parsedArgs = JSON.parse(cleanedArguments)
			expect(parsedArgs.path).toBe("/path/to/file.txt")
		})

		it("should handle complex JSON arguments with erroneous closing tags", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "database",
					tool_name: "query",
					arguments: '{"query": "SELECT * FROM users", "limit": 10, "offset": 0}</use_mcp_tool>',
				},
				partial: false,
			}

			const removeClosingTag = createRemoveClosingTagFunction(block)
			const cleanedArguments = removeClosingTag("arguments", block.params.arguments)

			expect(cleanedArguments).toBe('{"query": "SELECT * FROM users", "limit": 10, "offset": 0}')

			// Verify valid JSON parsing
			const parsedArgs = JSON.parse(cleanedArguments)
			expect(parsedArgs.query).toBe("SELECT * FROM users")
			expect(parsedArgs.limit).toBe(10)
			expect(parsedArgs.offset).toBe(0)
		})
	})
})
