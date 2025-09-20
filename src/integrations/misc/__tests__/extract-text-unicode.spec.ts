import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { extractTextFromFile } from "../extract-text"
import { readLines } from "../read-lines"
import { tmpdir } from "os"

describe("Unicode and UTF-8 handling", () => {
	let tempDir: string
	let testFilePath: string

	beforeEach(async () => {
		// Create a temporary directory for test files
		tempDir = await fs.mkdtemp(path.join(tmpdir(), "unicode-test-"))
	})

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("extractTextFromFile with Unicode content", () => {
		it("should handle Chinese characters correctly", async () => {
			const content = `# 测试文件
-   **时间戳 (Timestamp)**: 2025-07-26 15:41
-   **任务/目标 (Task/Goal)**: 实现问卷的前端核心交互逻辑。`

			testFilePath = path.join(tempDir, "chinese.md")
			await fs.writeFile(testFilePath, content, "utf8")

			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("时间戳")
			expect(result).toContain("任务/目标")
			expect(result).toContain("实现问卷的前端核心交互逻辑")
		})

		it("should handle mixed Unicode content (emoji, various languages)", async () => {
			const content = `# Unicode Test
😀 Emoji test 🎉
日本語: こんにちは世界
한국어: 안녕하세요 세계
العربية: مرحبا بالعالم
עברית: שלום עולם
Русский: Привет мир`

			testFilePath = path.join(tempDir, "mixed-unicode.md")
			await fs.writeFile(testFilePath, content, "utf8")

			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("😀")
			expect(result).toContain("🎉")
			expect(result).toContain("こんにちは世界")
			expect(result).toContain("안녕하세요")
			expect(result).toContain("مرحبا بالعالم")
			expect(result).toContain("שלום עולם")
			expect(result).toContain("Привет мир")
		})

		it("should handle special Unicode characters", async () => {
			const content = `Special chars:
Non-breaking space: test test
Zero-width space: test\u200Btest
Quotes: "test" 'test' „test" «test»
Math: ∑ ∏ ∫ √ ∞ ≈ ≠ ≤ ≥`

			testFilePath = path.join(tempDir, "special-chars.md")
			await fs.writeFile(testFilePath, content, "utf8")

			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("Non-breaking space")
			expect(result).toContain("Zero-width space")
			expect(result).toContain('"test"')
			expect(result).toContain("∑")
			expect(result).toContain("∞")
		})

		it("should handle files with BOM (Byte Order Mark)", async () => {
			const content = "Test content with BOM"
			const bom = "\uFEFF"

			testFilePath = path.join(tempDir, "bom-file.txt")
			await fs.writeFile(testFilePath, bom + content, "utf8")

			const result = await extractTextFromFile(testFilePath)
			// Should handle BOM gracefully
			expect(result).toContain("Test content with BOM")
		})

		it("should handle invalid UTF-8 sequences gracefully", async () => {
			// Create a file with potentially problematic byte sequences
			testFilePath = path.join(tempDir, "invalid-utf8.md") // Use .md extension

			// Write raw bytes that might cause UTF-8 decoding issues
			const buffer = Buffer.from([
				0x48,
				0x65,
				0x6c,
				0x6c,
				0x6f, // "Hello"
				0x20, // space
				0xff,
				0xfe, // Invalid UTF-8 sequence
				0x20, // space
				0x57,
				0x6f,
				0x72,
				0x6c,
				0x64, // "World"
			])
			await fs.writeFile(testFilePath, buffer)

			// Should not throw and should return readable content
			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("Hello")
			expect(result).toContain("World")
		})
	})

	describe("readLines with Unicode content", () => {
		it("should handle Chinese characters in line ranges", async () => {
			const content = `第一行
第二行：时间戳
第三行：任务/目标
第四行：关键决策`

			testFilePath = path.join(tempDir, "chinese-lines.txt")
			await fs.writeFile(testFilePath, content, "utf8")

			const result = await readLines(testFilePath, 2, 1)
			expect(result).toContain("第二行")
			expect(result).toContain("第三行")
			expect(result).not.toContain("第一行")
			expect(result).not.toContain("第四行")
		})

		it("should handle emoji in specific line ranges", async () => {
			const content = `Line 1: Regular text
Line 2: 😀 Happy emoji
Line 3: 🚀 Rocket emoji
Line 4: Regular text again`

			testFilePath = path.join(tempDir, "emoji-lines.txt")
			await fs.writeFile(testFilePath, content, "utf8")

			const result = await readLines(testFilePath, 2, 1)
			expect(result).toContain("😀")
			expect(result).toContain("🚀")
		})

		it("should handle mixed scripts in line reading", async () => {
			const lines = [
				"English line",
				"中文行",
				"日本語の行",
				"한국어 줄",
				"Русская строка",
				"שורה בעברית",
				"سطر عربي",
			]

			testFilePath = path.join(tempDir, "mixed-scripts.txt")
			await fs.writeFile(testFilePath, lines.join("\n"), "utf8")

			// Read middle lines
			const result = await readLines(testFilePath, 4, 2)
			expect(result).toContain("日本語の行")
			expect(result).toContain("한국어 줄")
			expect(result).toContain("Русская строка")
			expect(result).not.toContain("English line")
			expect(result).not.toContain("שורה בעברית")
		})

		it("should handle invalid UTF-8 in line reading gracefully", async () => {
			testFilePath = path.join(tempDir, "invalid-utf8-lines.txt")

			// Create content with invalid sequences
			const validLine1 = Buffer.from("First line\n", "utf8")
			const invalidLine = Buffer.concat([
				Buffer.from("Second ", "utf8"),
				Buffer.from([0xff, 0xfe]), // Invalid UTF-8
				Buffer.from(" line\n", "utf8"),
			])
			const validLine3 = Buffer.from("Third line\n", "utf8")

			await fs.writeFile(testFilePath, Buffer.concat([validLine1, invalidLine, validLine3]))

			// Should handle gracefully
			const result = await readLines(testFilePath, 2, 0)
			expect(result).toContain("First line")
			expect(result).toContain("line") // Should contain parts of the second line
			expect(result).toContain("Third line")
		})
	})

	describe("Edge cases and stress tests", () => {
		it("should handle very long lines with Unicode", async () => {
			// Create a very long line with repeated Unicode characters
			const longLine = "测试".repeat(10000) + "\n" + "第二行"

			testFilePath = path.join(tempDir, "long-unicode.txt")
			await fs.writeFile(testFilePath, longLine, "utf8")

			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("测试")
			expect(result).toContain("第二行")
		})

		it("should handle empty files", async () => {
			testFilePath = path.join(tempDir, "empty.txt")
			await fs.writeFile(testFilePath, "", "utf8")

			const result = await extractTextFromFile(testFilePath)
			expect(result).toBe("")
		})

		it("should handle files with only Unicode characters", async () => {
			const content = "中文中文中文中文中文"

			testFilePath = path.join(tempDir, "only-unicode.txt")
			await fs.writeFile(testFilePath, content, "utf8")

			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("中文中文中文中文中文")
		})

		it("should handle the exact reproduction case from the issue", async () => {
			const content = `-   **时间戳 (Timestamp)**: 2025-07-26 15:41
-   **任务/目标 (Task/Goal)**: 实现问卷的前端核心交互逻辑。
-   **关键决策/操作 (Key Decision/Action)**:
		  1.  在 \`questionnaire-server/public/index.html\` 中添加了 \`<div id="questionnaire-container"></div>\` 作为动态内容的挂载点。
		  2.  在 \`questionnaire-server/public/style.css\` 中添加了完整的基础样式，确保界面干净、可用，并对问卷的各个部分（欢迎页、问题页、选项）进行了样式设置。`

			testFilePath = path.join(tempDir, "issue-reproduction.md")
			await fs.writeFile(testFilePath, content, "utf8")

			// This should not throw or hang
			const result = await extractTextFromFile(testFilePath)
			expect(result).toContain("时间戳 (Timestamp)")
			expect(result).toContain("任务/目标 (Task/Goal)")
			expect(result).toContain("关键决策/操作")
			expect(result).toContain("questionnaire-server/public/index.html")
			expect(result).toContain("questionnaire-container")
		}, 30000) // Increase timeout to 30 seconds
	})
})
