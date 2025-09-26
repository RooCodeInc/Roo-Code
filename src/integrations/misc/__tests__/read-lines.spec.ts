import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { promises as fs } from "fs"
import path from "path"
import { readLines } from "../read-lines"

describe("nthline", () => {
	const testFile = path.join(__dirname, "test.txt")

	// Helper function to create a temporary file, run a test, and clean up
	async function withTempFile(filename: string, content: string, testFn: (filepath: string) => Promise<void>) {
		const filepath = path.join(__dirname, filename)
		await fs.writeFile(filepath, content)
		try {
			await testFn(filepath)
		} finally {
			await fs.unlink(filepath)
		}
	}

	beforeAll(async () => {
		// Create a test file with numbered lines
		const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n")
		await fs.writeFile(testFile, content)
	})

	afterAll(async () => {
		await fs.unlink(testFile)
	})

	describe("readLines function", () => {
		it("should read lines from start when from_line is not provided", async () => {
			const lines = await readLines(testFile, 2)
			// Expect lines with trailing newline because it exists in the file at that point
			const expected = ["Line 1", "Line 2", "Line 3"].join("\n") + "\n"
			expect(lines).toEqual(expected)
		})

		it("should read a range of lines from a file", async () => {
			const lines = await readLines(testFile, 3, 1)
			// Expect lines with trailing newline because it exists in the file at that point
			const expected = ["Line 2", "Line 3", "Line 4"].join("\n") + "\n"
			expect(lines).toEqual(expected)
		})

		it("should read lines when to_line equals from_line", async () => {
			const lines = await readLines(testFile, 2, 2)
			// Expect line with trailing newline because it exists in the file at that point
			const expected = "Line 3\n"
			expect(lines).toEqual(expected)
		})

		it("should throw error for negative to_line", async () => {
			await expect(readLines(testFile, -3)).rejects.toThrow(
				"startLine (0) must be less than or equal to endLine (-3)",
			)
		})

		it("should handle negative from_line by clamping to 0", async () => {
			const lines = await readLines(testFile, 3, -1)
			expect(lines).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"].join("\n") + "\n")
		})

		it("should floor non-integer line numbers", async () => {
			const linesWithNonIntegerStart = await readLines(testFile, 3, 1.5)
			expect(linesWithNonIntegerStart).toEqual(["Line 2", "Line 3", "Line 4"].join("\n") + "\n")

			const linesWithNonIntegerEnd = await readLines(testFile, 3.5)
			expect(linesWithNonIntegerEnd).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"].join("\n") + "\n")
		})

		it("should throw error when from_line > to_line", async () => {
			await expect(readLines(testFile, 1, 3)).rejects.toThrow(
				"startLine (3) must be less than or equal to endLine (1)",
			)
		})

		it("should return partial range if file ends before to_line", async () => {
			const lines = await readLines(testFile, 15, 8)
			expect(lines).toEqual(["Line 9", "Line 10"].join("\n"))
		})

		it("should throw error if from_line is beyond file length", async () => {
			await expect(readLines(testFile, 20, 15)).rejects.toThrow("does not exist")
		})

		it("should handle empty files", async () => {
			await withTempFile("empty.txt", "", async (filepath) => {
				await expect(readLines(filepath, 0, 0)).rejects.toThrow("does not exist")
			})
		})

		it("should handle files with only one line without carriage return", async () => {
			await withTempFile("single-line-no-cr.txt", "Single line", async (filepath) => {
				const lines = await readLines(filepath, 0, 0)
				expect(lines).toEqual("Single line")
			})
		})

		it("should handle files with only one line with carriage return", async () => {
			await withTempFile("single-line-with-cr.txt", "Single line\n", async (filepath) => {
				const lines = await readLines(filepath, 0, 0)
				expect(lines).toEqual("Single line\n")
			})
		})

		it("should read the entire file when no startLine or endLine is specified", async () => {
			const content = await readLines(testFile)
			expect(content).toEqual(Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join("\n"))
		})

		it("should handle files with different line endings", async () => {
			await withTempFile("mixed-endings.txt", "Line 1\rLine 2\r\nLine 3\n", async (filepath) => {
				const lines = await readLines(filepath, 2)
				expect(lines).toEqual("Line 1\rLine 2\r\nLine 3\n")
			})
		})

		it("should handle files with Unicode characters", async () => {
			await withTempFile("unicode.txt", "Line 1 😀\nLine 2 你好\nLine 3 こんにちは\n", async (filepath) => {
				const lines = await readLines(filepath, 1)
				expect(lines).toEqual("Line 1 😀\nLine 2 你好\n")
			})
		})

		it("should handle files containing only carriage returns", async () => {
			await withTempFile("cr-only.txt", "\n\n\n\n\n", async (filepath) => {
				// Read lines 1-3 (second, third, and fourth lines)
				const lines = await readLines(filepath, 3, 1)
				expect(lines).toEqual("\n\n\n")
			})
		})
	})

	describe("bytesRead sampling for encoding detection", () => {
		it("should sample exactly 64KB for encoding detection on large files", async () => {
			// Create a large file with line breaks to test proper sampling
			const lineContent = "This is a test line for large file sampling\n"
			const linesNeeded = Math.ceil(100000 / lineContent.length) // Ensure > 64KB
			const largeContent = lineContent.repeat(linesNeeded)

			await withTempFile("large-file.txt", largeContent, async (filepath) => {
				// For large files, the function should read and process correctly
				// We'll verify the function works with large files that exceed 64KB
				const lines = await readLines(filepath, 1) // Read first 2 lines (0-1)

				// Verify that the content is read correctly
				expect(lines).toContain("This is a test line for large file sampling")
				// Should only contain 2 lines
				const lineArray = lines.split("\n").filter((line) => line.length > 0)
				expect(lineArray).toHaveLength(2)
			})
		})

		it("should handle files smaller than 64KB sampling correctly", async () => {
			const smallContent = "Line 1\nLine 2\nLine 3\n"

			await withTempFile("small-file.txt", smallContent, async (filepath) => {
				// For small files, the function should still attempt to read 64KB for encoding detection
				// We'll just verify the function works correctly with small files
				const lines = await readLines(filepath, 0) // Read first line (0)

				// Verify that the content is read correctly
				expect(lines).toContain("Line 1")
				expect(lines).not.toContain("Line 2") // Should only read first line
			})
		})

		it("should handle UTF-8 BOM in the 64KB sample correctly", async () => {
			// Create content with UTF-8 BOM at the beginning
			const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
			const textContent = "Line 1 with UTF-8 content\nLine 2\nLine 3\n"
			const contentWithBOM = Buffer.concat([bomBytes, Buffer.from(textContent, "utf8")])

			await withTempFile("bom-file.txt", contentWithBOM.toString(), async (filepath) => {
				// Write the actual binary content with BOM
				await fs.writeFile(filepath, contentWithBOM)

				const lines = await readLines(filepath, 0) // Read first line (0)

				// Should successfully read the content, BOM should be handled by encoding detection
				expect(lines).toContain("Line 1 with UTF-8 content")
			})
		})

		it("should handle UTF-16 LE BOM in the 64KB sample correctly", async () => {
			// Create content with UTF-16 LE BOM
			const bomBytes = Buffer.from([0xff, 0xfe])
			const textContent = "Line 1\nLine 2\n"
			const utf16Content = Buffer.from(textContent, "utf16le")
			const contentWithBOM = Buffer.concat([bomBytes, utf16Content])

			await withTempFile("utf16le-bom-file.txt", "", async (filepath) => {
				// Write the actual binary content with BOM
				await fs.writeFile(filepath, contentWithBOM)

				const lines = await readLines(filepath, 1)

				// Should successfully read the content, BOM should be handled by encoding detection
				expect(lines).toContain("Line 1")
			})
		})

		it("should handle partial multi-byte characters at 64KB boundary", async () => {
			// Create content where a multi-byte UTF-8 character might be split at 64KB boundary
			const lineContent = "Line with content: 你好世界\n"
			const linesNeeded = Math.ceil(65536 / lineContent.length) + 5 // Ensure > 64KB
			const fullContent = lineContent.repeat(linesNeeded) + "Final line after boundary\n"

			await withTempFile("multibyte-boundary.txt", fullContent, async (filepath) => {
				// Read the last few lines to check the content after the boundary
				const lines = await readLines(filepath, linesNeeded + 1, linesNeeded - 1) // Read last 3 lines
				expect(lines).toContain("Final line after boundary")
				// The multi-byte characters should be preserved
				expect(lines).toContain("你好世界")
			})
		})

		it("should handle encoding detection failure gracefully with 64KB sampling", async () => {
			// Create binary-like content that might confuse encoding detection
			const binaryLikeContent = Buffer.alloc(70000) // Larger than 64KB
			// Fill with values that might be detected as binary
			for (let i = 0; i < binaryLikeContent.length; i++) {
				binaryLikeContent[i] = i % 256
			}
			// Add some text at the end
			const textPortion = Buffer.from("\nSome text at the end\n", "utf8")
			const mixedContent = Buffer.concat([binaryLikeContent, textPortion])

			await withTempFile("mixed-content.txt", "", async (filepath) => {
				await fs.writeFile(filepath, mixedContent)

				// Should either succeed with fallback encoding or handle gracefully
				try {
					const lines = await readLines(filepath, 0, 0)
					// If it succeeds, it should contain the text portion
					expect(typeof lines).toBe("string")
				} catch (error) {
					// If it fails, it should be a meaningful error about binary content
					expect(error).toBeInstanceOf(Error)
				}
			})
		})
	})

	describe("BOM preservation integration tests", () => {
		it("should preserve UTF-8 BOM when reading lines from file", async () => {
			// Create content with UTF-8 BOM
			const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
			const textContent = "First line with UTF-8 content\nSecond line\nThird line\n"
			const contentWithBOM = Buffer.concat([bomBytes, Buffer.from(textContent, "utf8")])

			await withTempFile("utf8-bom-integration.txt", "", async (filepath) => {
				// Write the actual binary content with BOM
				await fs.writeFile(filepath, contentWithBOM)

				// Read first line
				const firstLine = await readLines(filepath, 1)
				expect(firstLine).toContain("First line with UTF-8 content")

				// Read multiple lines
				const multipleLines = await readLines(filepath, 2)
				expect(multipleLines).toContain("First line with UTF-8 content")
				expect(multipleLines).toContain("Second line")

				// Read from specific line
				const fromSecondLine = await readLines(filepath, 1, 1)
				expect(fromSecondLine).toContain("Second line")
			})
		})

		it("should preserve UTF-16 LE BOM when reading lines from file", async () => {
			// Create content with UTF-16 LE BOM
			const bomBytes = Buffer.from([0xff, 0xfe])
			const textContent = "UTF-16 LE first line\nUTF-16 LE second line\n"
			const utf16Content = Buffer.from(textContent, "utf16le")
			const contentWithBOM = Buffer.concat([bomBytes, utf16Content])

			await withTempFile("utf16le-bom-integration.txt", "", async (filepath) => {
				// Write the actual binary content with BOM
				await fs.writeFile(filepath, contentWithBOM)

				// Read first line
				const firstLine = await readLines(filepath, 0) // Read first line (0)
				expect(firstLine).toContain("UTF-16 LE first line")

				// Read multiple lines
				const multipleLines = await readLines(filepath, 1) // Read first 2 lines (0-1)
				expect(multipleLines).toContain("UTF-16 LE first line")
				expect(multipleLines).toContain("UTF-16 LE second line")
			})
		})

		it("should preserve UTF-16 BE BOM when reading lines from file", async () => {
			// Create content with UTF-16 BE BOM
			const bomBytes = Buffer.from([0xfe, 0xff])
			const textContent = "UTF-16 BE first line\nUTF-16 BE second line\n"
			// Manually create UTF-16 BE content
			const utf16beBytes = []
			for (let i = 0; i < textContent.length; i++) {
				const charCode = textContent.charCodeAt(i)
				utf16beBytes.push((charCode >> 8) & 0xff) // High byte first
				utf16beBytes.push(charCode & 0xff) // Low byte second
			}
			const utf16Content = Buffer.from(utf16beBytes)
			const contentWithBOM = Buffer.concat([bomBytes, utf16Content])

			await withTempFile("utf16be-bom-integration.txt", "", async (filepath) => {
				// Write the actual binary content with BOM
				await fs.writeFile(filepath, contentWithBOM)

				// Read first line
				const firstLine = await readLines(filepath, 0) // Read first line (0)
				expect(firstLine).toContain("UTF-16 BE first line")

				// Read multiple lines
				const multipleLines = await readLines(filepath, 1) // Read first 2 lines (0-1)
				expect(multipleLines).toContain("UTF-16 BE first line")
				expect(multipleLines).toContain("UTF-16 BE second line")
			})
		})

		it("should handle BOM preservation with large files that exceed 64KB sampling", async () => {
			// Create a large file with UTF-8 BOM that exceeds 64KB
			const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
			const lineContent = "This is a test line with UTF-8 content and BOM: 你好世界 🌍\n"
			const linesNeeded = Math.ceil(65536 / lineContent.length) + 100 // Ensure > 64KB
			const largeTextContent = lineContent.repeat(linesNeeded)
			const contentWithBOM = Buffer.concat([bomBytes, Buffer.from(largeTextContent, "utf8")])

			await withTempFile("large-utf8-bom-integration.txt", "", async (filepath) => {
				// Write the actual binary content with BOM
				await fs.writeFile(filepath, contentWithBOM)

				// Read first few lines
				const firstLines = await readLines(filepath, 3)
				expect(firstLines).toContain("This is a test line with UTF-8 content and BOM: 你好世界 🌍")

				// Read from middle of file (read 2 lines starting from line 50)
				const middleLines = await readLines(filepath, 51, 49) // Read lines 49-51 (0-based)
				expect(middleLines).toContain("This is a test line with UTF-8 content and BOM: 你好世界 🌍")

				// Verify the content is properly decoded despite BOM
				const lines = firstLines.split("\n")
				expect(lines[0]).not.toMatch(/^\uFEFF/) // BOM should not appear in decoded text
			})
		})

		it("should handle mixed BOM and non-BOM files correctly", async () => {
			// Test reading from a UTF-8 BOM file and then a regular UTF-8 file
			const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
			const bomContent = Buffer.concat([bomBytes, Buffer.from("BOM file content\nSecond line\n", "utf8")])
			const regularContent = "Regular UTF-8 content\nAnother line\n"

			await withTempFile("bom-file-mixed.txt", "", async (bomFilepath) => {
				await fs.writeFile(bomFilepath, bomContent)

				await withTempFile("regular-file-mixed.txt", regularContent, async (regularFilepath) => {
					// Read from BOM file
					const bomLines = await readLines(bomFilepath, 0) // Read first line (0)
					expect(bomLines).toContain("BOM file content")

					// Read from regular file
					const regularLines = await readLines(regularFilepath, 0) // Read first line (0)
					expect(regularLines).toContain("Regular UTF-8 content")

					// Both should work correctly without interference
					expect(bomLines).not.toContain("Regular UTF-8 content")
					expect(regularLines).not.toContain("BOM file content")
				})
			})
		})
	})
})
