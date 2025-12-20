import { describe, it, expect } from "vitest"
import {
	CodeSnippet,
	createCodeSnippetId,
	formatCodeSnippetLabel,
	expandCodeSnippet,
	expandCodeSnippets,
} from "../code-snippet.js"

describe("code-snippet", () => {
	describe("createCodeSnippetId", () => {
		it("should create unique IDs", () => {
			const id1 = createCodeSnippetId()
			const id2 = createCodeSnippetId()
			expect(id1).not.toBe(id2)
		})

		it("should start with 'snippet-' prefix", () => {
			const id = createCodeSnippetId()
			expect(id).toMatch(/^snippet-/)
		})
	})

	describe("formatCodeSnippetLabel", () => {
		it("should format label with only line numbers", () => {
			const snippet: CodeSnippet = {
				id: "test-id",
				filePath: "src/components/Button.tsx",
				startLine: 10,
				endLine: 25,
				content: "const Button = () => {}",
				timestamp: Date.now(),
			}
			expect(formatCodeSnippetLabel(snippet)).toBe("lines 10-25")
		})

		it("should handle single line snippet", () => {
			const snippet: CodeSnippet = {
				id: "test-id",
				filePath: "index.ts",
				startLine: 1,
				endLine: 1,
				content: "export default {}",
				timestamp: Date.now(),
			}
			expect(formatCodeSnippetLabel(snippet)).toBe("lines 1-1")
		})
	})

	describe("expandCodeSnippet", () => {
		it("should expand snippet to full format with file path", () => {
			const snippet: CodeSnippet = {
				id: "test-id",
				filePath: "src/utils.ts",
				startLine: 5,
				endLine: 10,
				content: "function helper() {\n  return true;\n}",
				timestamp: Date.now(),
			}
			const result = expandCodeSnippet(snippet)
			expect(result).toContain("src/utils.ts:5-10")
			expect(result).toContain("```")
			expect(result).toContain("function helper()")
		})
	})

	describe("expandCodeSnippets", () => {
		it("should expand multiple snippets with spacing", () => {
			const snippets: CodeSnippet[] = [
				{
					id: "test-1",
					filePath: "file1.ts",
					startLine: 1,
					endLine: 5,
					content: "const a = 1",
					timestamp: Date.now(),
				},
				{
					id: "test-2",
					filePath: "file2.ts",
					startLine: 10,
					endLine: 15,
					content: "const b = 2",
					timestamp: Date.now(),
				},
			]
			const result = expandCodeSnippets(snippets)
			expect(result).toContain("file1.ts:1-5")
			expect(result).toContain("file2.ts:10-15")
			expect(result).toContain("\n\n")
		})

		it("should return empty string for empty array", () => {
			expect(expandCodeSnippets([])).toBe("")
		})
	})
})
