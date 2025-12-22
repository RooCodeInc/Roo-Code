import { promises as fs } from "fs"
import path from "path"
import { readSlice, readIndentationBlock, readFileContent, measureIndent } from "../read-file-content"

describe("read-file-content", () => {
	const testDir = __dirname

	// Helper function to create a temporary file, run a test, and clean up
	async function withTempFile(filename: string, content: string, testFn: (filepath: string) => Promise<void>) {
		const filepath = path.join(testDir, filename)
		await fs.writeFile(filepath, content)
		try {
			await testFn(filepath)
		} finally {
			await fs.unlink(filepath)
		}
	}

	describe("measureIndent", () => {
		it("should measure spaces correctly", () => {
			expect(measureIndent("    hello")).toBe(4)
			expect(measureIndent("  hello")).toBe(2)
			expect(measureIndent("hello")).toBe(0)
		})

		it("should treat tabs as 4 spaces", () => {
			expect(measureIndent("\thello")).toBe(4)
			expect(measureIndent("\t\thello")).toBe(8)
			expect(measureIndent("  \thello")).toBe(6) // 2 spaces + 4 for tab
		})

		it("should handle empty lines", () => {
			expect(measureIndent("")).toBe(0)
			expect(measureIndent("   ")).toBe(3)
		})
	})

	describe("readSlice", () => {
		it("should read lines from start by default", async () => {
			const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n")
			await withTempFile("slice-test.txt", content, async (filepath) => {
				const result = await readSlice(filepath, 1, 3)
				expect(result.lineCount).toBe(3)
				expect(result.content).toContain("1 | Line 1")
				expect(result.content).toContain("2 | Line 2")
				expect(result.content).toContain("3 | Line 3")
			})
		})

		it("should read lines from specified offset", async () => {
			const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n")
			await withTempFile("slice-offset-test.txt", content, async (filepath) => {
				const result = await readSlice(filepath, 5, 3)
				expect(result.lineCount).toBe(3)
				expect(result.content).toContain("5 | Line 5")
				expect(result.content).toContain("6 | Line 6")
				expect(result.content).toContain("7 | Line 7")
			})
		})

		it("should handle reading beyond file end", async () => {
			const content = "Line 1\nLine 2\nLine 3"
			await withTempFile("slice-beyond-test.txt", content, async (filepath) => {
				const result = await readSlice(filepath, 1, 100)
				expect(result.lineCount).toBe(3)
				expect(result.totalLines).toBe(3)
			})
		})

		it("should throw error for offset=0", async () => {
			const content = "Line 1\nLine 2"
			await withTempFile("slice-zero-offset-test.txt", content, async (filepath) => {
				await expect(readSlice(filepath, 0, 3)).rejects.toThrow("offset must be a 1-indexed line number")
			})
		})

		it("should throw error for limit=0", async () => {
			const content = "Line 1\nLine 2"
			await withTempFile("slice-zero-limit-test.txt", content, async (filepath) => {
				await expect(readSlice(filepath, 1, 0)).rejects.toThrow("limit must be greater than zero")
			})
		})

		it("should return empty content when offset exceeds file length", async () => {
			const content = "Line 1\nLine 2"
			await withTempFile("slice-past-end-test.txt", content, async (filepath) => {
				const result = await readSlice(filepath, 100, 3)
				expect(result.content).toBe("")
				expect(result.lineCount).toBe(0)
				expect(result.totalLines).toBe(2)
				expect(result.metadata.totalLinesInFile).toBe(2)
			})
		})

		it("should truncate long lines", async () => {
			const longLine = "x".repeat(600) // Longer than MAX_LINE_LENGTH (500)
			await withTempFile("slice-long-line-test.txt", longLine, async (filepath) => {
				const result = await readSlice(filepath, 1, 1)
				// Line should be truncated to 500 characters + line number prefix
				expect(result.content.length).toBeLessThan(600)
			})
		})

		it("should handle files with CRLF line endings", async () => {
			const content = "Line 1\r\nLine 2\r\nLine 3"
			await withTempFile("slice-crlf-test.txt", content, async (filepath) => {
				const result = await readSlice(filepath, 1, 3)
				expect(result.lineCount).toBe(3)
				expect(result.content).not.toContain("\r")
			})
		})
	})

	describe("readIndentationBlock", () => {
		const pythonCode = `def outer():
    x = 1
    def inner():
        y = 2
        return y
    return inner()

def another():
    pass`

		it("should extract a function block with its contents", async () => {
			await withTempFile("indent-function-test.py", pythonCode, async (filepath) => {
				const result = await readIndentationBlock(filepath, 1, 100, { anchorLine: 3 })
				// Should include "def inner():" and its body
				expect(result.content).toContain("def inner():")
				expect(result.content).toContain("y = 2")
				expect(result.content).toContain("return y")
			})
		})

		it("should respect maxLevels parameter", async () => {
			await withTempFile("indent-levels-test.py", pythonCode, async (filepath) => {
				const result = await readIndentationBlock(filepath, 4, 50, {
					anchorLine: 4,
					maxLevels: 1,
				})
				// With maxLevels=1, should only go up one level from the anchor
				expect(result.content).toContain("y = 2")
			})
		})

		it("should include sibling blocks when includeSiblings is true", async () => {
			await withTempFile("indent-siblings-test.py", pythonCode, async (filepath) => {
				const result = await readIndentationBlock(filepath, 1, 100, {
					anchorLine: 1,
					includeSiblings: true,
				})
				// Should include both functions
				expect(result.content).toContain("def outer():")
				expect(result.content).toContain("def another():")
			})
		})

		it("should throw error for anchorLine=0", async () => {
			await withTempFile("indent-zero-anchor-test.py", pythonCode, async (filepath) => {
				await expect(readIndentationBlock(filepath, 1, 100, { anchorLine: 0 })).rejects.toThrow(
					"anchorLine must be a 1-indexed line number",
				)
			})
		})

		it("should throw error when anchorLine exceeds file length", async () => {
			await withTempFile("indent-past-end-test.py", pythonCode, async (filepath) => {
				await expect(readIndentationBlock(filepath, 1, 100, { anchorLine: 100 })).rejects.toThrow(
					"anchorLine exceeds file length",
				)
			})
		})

		it("should handle single line result", async () => {
			const content = "single line"
			await withTempFile("indent-single-test.txt", content, async (filepath) => {
				const result = await readIndentationBlock(filepath, 1, 1, { anchorLine: 1 })
				expect(result.lineCount).toBe(1)
				expect(result.content).toContain("single line")
			})
		})

		it("should trim leading/trailing blank lines", async () => {
			const content = "\n\ndef foo():\n    pass\n\n"
			await withTempFile("indent-trim-test.py", content, async (filepath) => {
				const result = await readIndentationBlock(filepath, 3, 100, { anchorLine: 3 })
				// Should not start or end with blank lines
				const lines = result.content.split("\n").filter((l) => l.trim())
				expect(lines.length).toBeGreaterThan(0)
				expect(lines[0]).toContain("def foo():")
			})
		})

		it("should include comment headers when includeHeader is true", async () => {
			const codeWithComment = `# This is a comment header
# describing the function
def my_function():
    return 42`
			await withTempFile("indent-header-test.py", codeWithComment, async (filepath) => {
				const result = await readIndentationBlock(filepath, 3, 100, {
					anchorLine: 3,
					includeHeader: true,
				})
				// Should include the comment header
				expect(result.content).toContain("# This is a comment header")
			})
		})
	})

	describe("readFileContent", () => {
		it("should use slice mode by default", async () => {
			const content = "Line 1\nLine 2\nLine 3"
			await withTempFile("mode-default-test.txt", content, async (filepath) => {
				const result = await readFileContent({
					filePath: filepath,
					offset: 1,
					limit: 2,
				})
				expect(result.lineCount).toBe(2)
				expect(result.content).toContain("1 | Line 1")
				expect(result.content).toContain("2 | Line 2")
			})
		})

		it("should use slice mode when explicitly specified", async () => {
			const content = "Line 1\nLine 2\nLine 3"
			await withTempFile("mode-slice-test.txt", content, async (filepath) => {
				const result = await readFileContent({
					filePath: filepath,
					offset: 2,
					limit: 2,
					mode: "slice",
				})
				expect(result.lineCount).toBe(2)
				expect(result.content).toContain("2 | Line 2")
				expect(result.content).toContain("3 | Line 3")
			})
		})

		it("should use indentation mode when specified", async () => {
			const pythonCode = `def outer():
    x = 1
    return x`
			await withTempFile("mode-indent-test.py", pythonCode, async (filepath) => {
				const result = await readFileContent({
					filePath: filepath,
					offset: 1,
					limit: 100,
					mode: "indentation",
					indentation: { anchorLine: 2 },
				})
				expect(result.content).toContain("x = 1")
			})
		})

		it("should use default values when not specified", async () => {
			const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n")
			await withTempFile("mode-defaults-test.txt", content, async (filepath) => {
				const result = await readFileContent({
					filePath: filepath,
				})
				// Should use default offset=1 and default limit
				expect(result.content).toContain("1 | Line 1")
			})
		})

		it("should handle empty files gracefully", async () => {
			await withTempFile("mode-empty-test.txt", "", async (filepath) => {
				const result = await readFileContent({ filePath: filepath })
				expect(result.content).toBe("")
				expect(result.lineCount).toBe(0)
				expect(result.totalLines).toBe(0)
			})
		})

		it("should handle Unicode content", async () => {
			const content = "Hello 👋\nWorld 🌍\nTest 测试"
			await withTempFile("mode-unicode-test.txt", content, async (filepath) => {
				const result = await readFileContent({
					filePath: filepath,
					mode: "slice",
				})
				expect(result.content).toContain("Hello 👋")
				expect(result.content).toContain("World 🌍")
				expect(result.content).toContain("Test 测试")
			})
		})
	})
})
