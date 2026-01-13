/**
 * Content Formatter Unit Tests
 *
 * Tests for the ContentFormatter class.
 */

import { ContentFormatter, createContentFormatter } from "../content-formatter.js"

describe("ContentFormatter", () => {
	describe("formatToolResult", () => {
		const formatter = new ContentFormatter()

		it("should format search results", () => {
			const content = "Found 5 results.\n\n# src/file.ts\n  1 | match"
			const result = formatter.formatToolResult("search", content)

			expect(result).toContain("Found 5 results in 1 file")
			expect(result).toContain("- src/file.ts")
			expect(result).toMatch(/^```/)
			expect(result).toMatch(/```$/)
		})

		it("should format read results", () => {
			const content = "line1\nline2\nline3"
			const result = formatter.formatToolResult("read", content)

			expect(result).toContain("line1")
			expect(result).toContain("line2")
			expect(result).toContain("line3")
			expect(result).toMatch(/^```/)
			expect(result).toMatch(/```$/)
		})

		it("should return content unchanged for unknown kinds", () => {
			const content = "some content"
			const result = formatter.formatToolResult("unknown", content)

			expect(result).toBe(content)
		})
	})

	describe("formatSearchResults", () => {
		const formatter = new ContentFormatter()

		it("should extract file count and result count", () => {
			const content = "Found 10 results.\n\n# src/a.ts\n  1 | code\n\n# src/b.ts\n  5 | code"
			const result = formatter.formatSearchResults(content)

			expect(result).toContain("Found 10 results in 2 files")
		})

		it("should list unique files alphabetically", () => {
			const content = "Found 3 results.\n\n# src/z.ts\n  1 | a\n\n# src/a.ts\n  2 | b\n\n# src/m.ts\n  3 | c"
			const result = formatter.formatSearchResults(content)

			const lines = result.split("\n")
			const fileLines = lines.filter((l) => l.startsWith("- "))

			expect(fileLines[0]).toBe("- src/a.ts")
			expect(fileLines[1]).toBe("- src/m.ts")
			expect(fileLines[2]).toBe("- src/z.ts")
		})

		it("should deduplicate repeated file paths", () => {
			const content =
				"Found 5 results.\n\n# src/file.ts\n  1 | a\n\n# src/file.ts\n  5 | b\n\n# src/other.ts\n  10 | c"
			const result = formatter.formatSearchResults(content)

			expect(result).toContain("in 2 files")
			expect((result.match(/- src\/file\.ts/g) || []).length).toBe(1)
		})

		it("should handle no files found", () => {
			const content = "No results found"
			const result = formatter.formatSearchResults(content)

			expect(result).toBe("No results found")
		})

		it("should handle singular result", () => {
			const content = "Found 1 result.\n\n# src/file.ts\n  1 | match"
			const result = formatter.formatSearchResults(content)

			expect(result).toContain("Found 1 result in 1 file")
		})

		it("should handle missing result count", () => {
			const content = "# src/file.ts\n  1 | match"
			const result = formatter.formatSearchResults(content)

			expect(result).toContain("Found matches in 1 file")
		})
	})

	describe("formatReadResults", () => {
		it("should return short content unchanged", () => {
			const formatter = new ContentFormatter({ maxReadLines: 100 })
			const content = "line1\nline2\nline3"
			const result = formatter.formatReadResults(content)

			expect(result).toBe(content)
		})

		it("should truncate long content", () => {
			const formatter = new ContentFormatter({ maxReadLines: 5 })
			const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`)
			const content = lines.join("\n")
			const result = formatter.formatReadResults(content)

			expect(result).toContain("line1")
			expect(result).toContain("line5")
			expect(result).not.toContain("line6")
			expect(result).toContain("... (5 more lines)")
		})

		it("should handle exactly maxReadLines", () => {
			const formatter = new ContentFormatter({ maxReadLines: 5 })
			const lines = Array.from({ length: 5 }, (_, i) => `line${i + 1}`)
			const content = lines.join("\n")
			const result = formatter.formatReadResults(content)

			expect(result).toBe(content)
		})

		it("should use default maxReadLines of 100", () => {
			const formatter = new ContentFormatter()
			const lines = Array.from({ length: 105 }, (_, i) => `line${i + 1}`)
			const content = lines.join("\n")
			const result = formatter.formatReadResults(content)

			expect(result).toContain("... (5 more lines)")
		})
	})

	describe("wrapInCodeBlock", () => {
		const formatter = new ContentFormatter()

		it("should wrap content in code block", () => {
			const result = formatter.wrapInCodeBlock("some code")

			expect(result).toBe("```\nsome code\n```")
		})

		it("should support language specification", () => {
			const result = formatter.wrapInCodeBlock("const x = 1", "typescript")

			expect(result).toBe("```typescript\nconst x = 1\n```")
		})

		it("should handle empty content", () => {
			const result = formatter.wrapInCodeBlock("")

			expect(result).toBe("```\n\n```")
		})

		it("should handle multiline content", () => {
			const result = formatter.wrapInCodeBlock("line1\nline2\nline3")

			expect(result).toBe("```\nline1\nline2\nline3\n```")
		})
	})

	describe("extractContentFromRawInput", () => {
		const formatter = new ContentFormatter()

		it("should extract content field", () => {
			const result = formatter.extractContentFromRawInput({ content: "my content" })
			expect(result).toBe("my content")
		})

		it("should extract text field", () => {
			const result = formatter.extractContentFromRawInput({ text: "my text" })
			expect(result).toBe("my text")
		})

		it("should extract result field", () => {
			const result = formatter.extractContentFromRawInput({ result: "my result" })
			expect(result).toBe("my result")
		})

		it("should extract output field", () => {
			const result = formatter.extractContentFromRawInput({ output: "my output" })
			expect(result).toBe("my output")
		})

		it("should extract fileContent field", () => {
			const result = formatter.extractContentFromRawInput({ fileContent: "my file content" })
			expect(result).toBe("my file content")
		})

		it("should extract data field", () => {
			const result = formatter.extractContentFromRawInput({ data: "my data" })
			expect(result).toBe("my data")
		})

		it("should prioritize content over other fields", () => {
			const result = formatter.extractContentFromRawInput({
				content: "content value",
				text: "text value",
				result: "result value",
			})
			expect(result).toBe("content value")
		})

		it("should return undefined for empty object", () => {
			const result = formatter.extractContentFromRawInput({})
			expect(result).toBeUndefined()
		})

		it("should return undefined for empty string values", () => {
			const result = formatter.extractContentFromRawInput({ content: "", text: "" })
			expect(result).toBeUndefined()
		})

		it("should skip non-string values", () => {
			const result = formatter.extractContentFromRawInput({
				content: 123 as unknown as string,
				text: "valid text",
			})
			expect(result).toBe("valid text")
		})
	})

	describe("extractFileContent", () => {
		const formatter = new ContentFormatter()

		it("should use extractContentFromRawInput for non-readFile tools", () => {
			const result = formatter.extractFileContent({ tool: "list_files", content: "file list" }, "/workspace")
			expect(result).toBe("file list")
		})

		it("should return undefined for readFile with no path", () => {
			const result = formatter.extractFileContent({ tool: "readFile" }, "/workspace")
			expect(result).toBeUndefined()
		})

		// Note: actual file reading is tested in integration tests
	})

	describe("isUserEcho", () => {
		const formatter = new ContentFormatter()

		it("should return false for null prompt", () => {
			expect(formatter.isUserEcho("any text", null)).toBe(false)
		})

		it("should detect exact match", () => {
			expect(formatter.isUserEcho("hello world", "hello world")).toBe(true)
		})

		it("should be case insensitive", () => {
			expect(formatter.isUserEcho("Hello World", "hello world")).toBe(true)
		})

		it("should handle whitespace differences", () => {
			expect(formatter.isUserEcho("  hello world  ", "hello world")).toBe(true)
		})

		it("should detect text contained in prompt (truncated)", () => {
			expect(formatter.isUserEcho("write a function", "write a function that adds numbers")).toBe(true)
		})

		it("should detect prompt contained in text (wrapped)", () => {
			expect(formatter.isUserEcho("User said: write a function here", "write a function")).toBe(true)
		})

		it("should not match short strings", () => {
			expect(formatter.isUserEcho("test", "this is a test prompt")).toBe(false)
		})

		it("should not match completely different text", () => {
			expect(formatter.isUserEcho("completely different", "original prompt text")).toBe(false)
		})

		it("should handle empty strings", () => {
			expect(formatter.isUserEcho("", "prompt")).toBe(false)
			expect(formatter.isUserEcho("text", "")).toBe(false)
		})
	})
})

describe("createContentFormatter", () => {
	it("should create a formatter with default config", () => {
		const formatter = createContentFormatter()
		expect(formatter).toBeInstanceOf(ContentFormatter)
	})

	it("should accept custom config", () => {
		const formatter = createContentFormatter({ maxReadLines: 50 })

		// Test that custom config is used
		const lines = Array.from({ length: 55 }, (_, i) => `line${i + 1}`)
		const content = lines.join("\n")
		const result = formatter.formatReadResults(content)

		expect(result).toContain("... (5 more lines)")
	})
})
