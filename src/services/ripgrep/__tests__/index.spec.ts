// npx vitest run src/services/ripgrep/__tests__/index.spec.ts

import { truncateLine } from "../index"

describe("Ripgrep file pattern escaping", () => {
	// Helper function to test file pattern escaping
	const escapeFilePattern = (pattern: string | undefined): string => {
		// This mirrors the logic in regexSearchFiles
		// Empty string is treated as falsy, so returns "*"
		return pattern ? pattern.replace(/ /g, "\\ ") : "*"
	}

	describe("File patterns with spaces", () => {
		it("should escape spaces in file patterns", () => {
			const pattern = "file with spaces.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("file\\ with\\ spaces.txt")
		})

		it("should handle multiple consecutive spaces", () => {
			const pattern = "file  with   multiple    spaces.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("file\\ \\ with\\ \\ \\ multiple\\ \\ \\ \\ spaces.txt")
		})

		it("should handle leading and trailing spaces", () => {
			const pattern = " leading and trailing spaces.txt "
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("\\ leading\\ and\\ trailing\\ spaces.txt\\ ")
		})
	})

	describe("File patterns with Unicode characters", () => {
		it("should handle Vietnamese Unicode characters with spaces", () => {
			const pattern = "Lịch Học LS26HP.md"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("Lịch\\ Học\\ LS26HP.md")
		})

		it("should handle Chinese characters with spaces", () => {
			const pattern = "中文 文件 名称.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("中文\\ 文件\\ 名称.txt")
		})

		it("should handle Arabic characters with spaces", () => {
			const pattern = "ملف عربي اختبار.md"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("ملف\\ عربي\\ اختبار.md")
		})

		it("should handle emoji with spaces", () => {
			const pattern = "📁 folder with emoji.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("📁\\ folder\\ with\\ emoji.txt")
		})

		it("should handle mixed Unicode and ASCII with spaces", () => {
			const pattern = "Mixed 混合 مختلط файл.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("Mixed\\ 混合\\ مختلط\\ файл.txt")
		})
	})

	describe("File patterns without spaces", () => {
		it("should not modify patterns without spaces", () => {
			const pattern = "simple-file-name.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("simple-file-name.txt")
		})

		it("should not modify Unicode patterns without spaces", () => {
			const pattern = "VietnameseFile_LịchHọc.md"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("VietnameseFile_LịchHọc.md")
		})
	})

	describe("Special cases", () => {
		it("should return '*' for undefined pattern", () => {
			const escaped = escapeFilePattern(undefined)
			expect(escaped).toBe("*")
		})

		it("should handle empty string as wildcard", () => {
			const escaped = escapeFilePattern("")
			expect(escaped).toBe("*") // Empty string is falsy, so returns "*"
		})

		it("should handle wildcard patterns with spaces", () => {
			const pattern = "* with spaces.md"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("*\\ with\\ spaces.md")
		})

		it("should handle glob patterns with spaces", () => {
			const pattern = "folder with spaces/*.txt"
			const escaped = escapeFilePattern(pattern)
			expect(escaped).toBe("folder\\ with\\ spaces/*.txt")
		})
	})
})

describe("Ripgrep line truncation", () => {
	// The default MAX_LINE_LENGTH is 500 in the implementation
	const MAX_LINE_LENGTH = 500

	it("should truncate lines longer than MAX_LINE_LENGTH", () => {
		const longLine = "a".repeat(600) // Line longer than MAX_LINE_LENGTH
		const truncated = truncateLine(longLine)

		expect(truncated).toContain("[truncated...]")
		expect(truncated.length).toBeLessThan(longLine.length)
		expect(truncated.length).toEqual(MAX_LINE_LENGTH + " [truncated...]".length)
	})

	it("should not truncate lines shorter than MAX_LINE_LENGTH", () => {
		const shortLine = "Short line of text"
		const truncated = truncateLine(shortLine)

		expect(truncated).toEqual(shortLine)
		expect(truncated).not.toContain("[truncated...]")
	})

	it("should correctly truncate a line at exactly MAX_LINE_LENGTH characters", () => {
		const exactLine = "a".repeat(MAX_LINE_LENGTH)
		const exactPlusOne = exactLine + "x"

		// Should not truncate when exactly MAX_LINE_LENGTH
		expect(truncateLine(exactLine)).toEqual(exactLine)

		// Should truncate when exceeding MAX_LINE_LENGTH by even 1 character
		expect(truncateLine(exactPlusOne)).toContain("[truncated...]")
	})

	it("should handle empty lines without errors", () => {
		expect(truncateLine("")).toEqual("")
	})

	it("should allow custom maximum length", () => {
		const customLength = 100
		const line = "a".repeat(customLength + 50)

		const truncated = truncateLine(line, customLength)

		expect(truncated.length).toEqual(customLength + " [truncated...]".length)
		expect(truncated).toContain("[truncated...]")
	})
})
