/**
 * MarkdownSectionExtractor 基础功能测试
 * 专门测试章节提取的核心功能
 */

import * as vscode from "vscode"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MarkdownSectionExtractor } from "../MarkdownSectionExtractor"

// Mock vscode module
vi.mock("vscode", () => ({
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, path, toString: () => path })),
	},
	Range: vi.fn((start, end) => ({ start, end })),
	Position: vi.fn((line, character) => ({ line, character })),
}))

describe("MarkdownSectionExtractor 基础功能测试", () => {
	let extractor: MarkdownSectionExtractor

	// 测试用的 markdown 内容
	const testMarkdownContent = `# 主标题

这是主标题下的内容。

## 二级标题 1

这是二级标题 1 的内容。

### 三级标题 1.1

这是三级标题 1.1 的内容。

### 三级标题 1.2

这是三级标题 1.2 的内容。

## 二级标题 2

这是二级标题 2 的内容。

#### 四级标题 2.1

这是四级标题 2.1 的内容。

## 二级标题 3

这是二级标题 3 的内容。

# 另一个主标题

这是另一个主标题的内容。`

	function createMockDocument(content: string): vscode.TextDocument {
		const lines = content.split("\n")
		return {
			uri: vscode.Uri.file("/test/document.md"),
			getText: vi.fn(() => content),
			lineCount: lines.length,
			lineAt: vi.fn((line: number) => ({
				text: lines[line] || "",
				lineNumber: line,
			})),
			version: 1,
		} as any
	}

	beforeEach(() => {
		vi.clearAllMocks()
		extractor = new MarkdownSectionExtractor()
	})

	afterEach(() => {
		extractor.clearCache()
	})

	describe("标题级别检测", () => {
		it("应该正确检测各级标题", () => {
			expect(extractor.detectHeaderLevel("# 一级标题")).toBe(1)
			expect(extractor.detectHeaderLevel("## 二级标题")).toBe(2)
			expect(extractor.detectHeaderLevel("### 三级标题")).toBe(3)
			expect(extractor.detectHeaderLevel("#### 四级标题")).toBe(4)
			expect(extractor.detectHeaderLevel("##### 五级标题")).toBe(5)
			expect(extractor.detectHeaderLevel("###### 六级标题")).toBe(6)
		})

		it("应该识别非标题行", () => {
			expect(extractor.detectHeaderLevel("普通文本")).toBe(-1)
			expect(extractor.detectHeaderLevel("")).toBe(-1)
			expect(extractor.detectHeaderLevel("####### 七级标题")).toBe(-1)
			expect(extractor.detectHeaderLevel("#没有空格")).toBe(-1)
		})

		it("应该处理标题后的空格", () => {
			// 前导空格的标题在 Markdown 中是无效的，应该返回 -1
			expect(extractor.detectHeaderLevel("  ## 带前导空格的标题")).toBe(-1)
			// 标题后的空格是允许的
			expect(extractor.detectHeaderLevel("### 标题后有空格   ")).toBe(3)
		})
	})

	describe("章节提取", () => {
		let mockDocument: vscode.TextDocument

		beforeEach(() => {
			mockDocument = createMockDocument(testMarkdownContent)
		})

		it("应该提取所有章节", () => {
			const sections = extractor.extractSections(mockDocument)

			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)

			// 验证主要章节
			const sectionTitles = sections.map((s) => s.cleanTitle)
			expect(sectionTitles).toContain("主标题")
			expect(sectionTitles).toContain("二级标题 1")
			expect(sectionTitles).toContain("三级标题 1.1")
			expect(sectionTitles).toContain("另一个主标题")

			console.log("提取的章节:", sectionTitles)
		})

		it("应该正确设置章节级别", () => {
			const sections = extractor.extractSections(mockDocument)

			const mainSection = sections.find((s) => s.cleanTitle === "主标题")
			const level2Section = sections.find((s) => s.cleanTitle === "二级标题 1")
			const level3Section = sections.find((s) => s.cleanTitle === "三级标题 1.1")

			expect(mainSection?.level).toBe(1)
			expect(level2Section?.level).toBe(2)
			expect(level3Section?.level).toBe(3)
		})

		it("应该正确设置章节边界", () => {
			const sections = extractor.extractSections(mockDocument)

			const level2Section1 = sections.find((s) => s.cleanTitle === "二级标题 1")
			const level2Section2 = sections.find((s) => s.cleanTitle === "二级标题 2")

			expect(level2Section1).toBeDefined()
			expect(level2Section2).toBeDefined()

			if (level2Section1 && level2Section2) {
				// 第一个二级标题的结束应该在第二个二级标题的开始之前
				expect(level2Section1.endLine).toBeLessThanOrEqual(level2Section2.startLine)
			}
		})
	})

	describe("章节内容提取", () => {
		let mockDocument: vscode.TextDocument

		beforeEach(() => {
			mockDocument = createMockDocument(testMarkdownContent)
		})

		it("应该提取指定章节的完整内容", () => {
			const lines = testMarkdownContent.split("\n")
			const level2HeaderLine = lines.findIndex((line) => line.trim() === "## 二级标题 1")

			expect(level2HeaderLine).toBeGreaterThanOrEqual(0)

			const content = extractor.getSectionContent(mockDocument, level2HeaderLine)

			expect(content).toContain("## 二级标题 1")
			expect(content).toContain("这是二级标题 1 的内容")
			expect(content).toContain("### 三级标题 1.1")
			expect(content).toContain("### 三级标题 1.2")
			expect(content).not.toContain("## 二级标题 2") // 不应包含下一个同级标题
		})

		it("应该支持不包含标题的选项", () => {
			const lines = testMarkdownContent.split("\n")
			const level2HeaderLine = lines.findIndex((line) => line.trim() === "## 二级标题 1")

			const content = extractor.getSectionContent(mockDocument, level2HeaderLine, {
				includeHeader: false,
			})

			expect(content).not.toContain("## 二级标题 1")
			expect(content).toContain("这是二级标题 1 的内容")
		})

		it("应该支持不包含子章节的选项", () => {
			const lines = testMarkdownContent.split("\n")
			const level2HeaderLine = lines.findIndex((line) => line.trim() === "## 二级标题 1")

			const content = extractor.getSectionContent(mockDocument, level2HeaderLine, {
				includeSubsections: false,
			})

			expect(content).toContain("## 二级标题 1")
			expect(content).toContain("这是二级标题 1 的内容")
			expect(content).not.toContain("### 三级标题 1.1")
		})

		it("应该支持深度限制", () => {
			const lines = testMarkdownContent.split("\n")
			const level2HeaderLine = lines.findIndex((line) => line.trim() === "## 二级标题 2")

			const content = extractor.getSectionContent(mockDocument, level2HeaderLine, {
				includeSubsections: true,
				maxDepth: 1, // 只包含一级子章节
			})

			expect(content).toContain("## 二级标题 2")
			expect(content).toContain("这是二级标题 2 的内容")
			// 四级标题相对于二级标题是 2 级深度，应该被排除
			expect(content).not.toContain("#### 四级标题 2.1")
		})

		it("应该处理去除空行选项", () => {
			const contentWithEmptyLines = `# 标题

这是内容。


这是更多内容。

`
			const docWithEmptyLines = createMockDocument(contentWithEmptyLines)

			const content = extractor.getSectionContent(docWithEmptyLines, 0, {
				trimEmptyLines: true,
			})

			// 应该去除首尾空行
			expect(content).not.toMatch(/^\s*\n/)
			expect(content).not.toMatch(/\n\s*$/)
		})
	})

	describe("章节边界检测", () => {
		it("应该正确找到章节边界", () => {
			const lines = testMarkdownContent.split("\n")
			const level2HeaderLine = lines.findIndex((line) => line.trim() === "## 二级标题 1")

			const boundary = extractor.findSectionBoundary(lines, level2HeaderLine, 2)

			expect(boundary.startLine).toBe(level2HeaderLine)
			expect(boundary.endLine).toBeGreaterThan(level2HeaderLine)

			// 结束行应该是下一个同级或更高级标题的位置
			const nextLevel2Line = lines.findIndex(
				(line, index) => index > level2HeaderLine && line.trim() === "## 二级标题 2",
			)
			expect(boundary.endLine).toBe(nextLevel2Line)
		})

		it("应该处理文档末尾的章节", () => {
			const lines = testMarkdownContent.split("\n")
			const lastHeaderLine = lines.findIndex((line) => line.trim() === "# 另一个主标题")

			const boundary = extractor.findSectionBoundary(lines, lastHeaderLine, 1)

			expect(boundary.startLine).toBe(lastHeaderLine)
			expect(boundary.endLine).toBe(lines.length) // 应该到文档末尾
		})
	})

	describe("缓存功能", () => {
		it("应该缓存提取结果", () => {
			const mockDocument = createMockDocument(testMarkdownContent)

			// 第一次提取
			const sections1 = extractor.extractSections(mockDocument)

			// 第二次提取应该使用缓存
			const sections2 = extractor.extractSections(mockDocument)

			expect(sections1).toEqual(sections2)

			// 验证缓存统计
			const cacheStats = extractor.getCacheStats()
			expect(cacheStats.size).toBeGreaterThan(0)
		})

		it("应该能够清理缓存", () => {
			const mockDocument = createMockDocument(testMarkdownContent)

			// 提取章节以填充缓存
			extractor.extractSections(mockDocument)

			// 验证缓存不为空
			let cacheStats = extractor.getCacheStats()
			expect(cacheStats.size).toBeGreaterThan(0)

			// 清理缓存
			extractor.clearCache()

			// 验证缓存已清空
			cacheStats = extractor.getCacheStats()
			expect(cacheStats.size).toBe(0)
		})
	})

	describe("错误处理", () => {
		it("应该处理空文档", () => {
			const emptyDocument = createMockDocument("")

			const sections = extractor.extractSections(emptyDocument)

			expect(sections).toBeDefined()
			expect(sections.length).toBe(0)
		})

		it("应该处理无效的行号", () => {
			const mockDocument = createMockDocument(testMarkdownContent)

			expect(() => {
				extractor.getSectionContent(mockDocument, -1)
			}).toThrow()

			expect(() => {
				extractor.getSectionContent(mockDocument, 9999)
			}).toThrow()
		})

		it("应该处理非标题行", () => {
			const mockDocument = createMockDocument(testMarkdownContent)

			expect(() => {
				extractor.getSectionContent(mockDocument, 1) // 普通文本行
			}).toThrow()
		})

		it("应该处理超大文档", () => {
			// 创建一个接近大小限制的文档
			const largeContent = "# 大文档\n" + "内容行\n".repeat(1000)
			const largeDocument = createMockDocument(largeContent)

			// 应该能够处理而不抛出异常
			expect(() => {
				extractor.extractSections(largeDocument)
			}).not.toThrow()
		})
	})

	describe("性能测试", () => {
		it("应该在合理时间内完成提取", () => {
			// 创建一个中等大小的文档
			const mediumContent = Array.from(
				{ length: 50 },
				(_, i) => `## 章节 ${i + 1}\n\n这是章节 ${i + 1} 的内容。\n\n`,
			).join("")

			const mediumDocument = createMockDocument(mediumContent)

			const startTime = Date.now()
			const sections = extractor.extractSections(mediumDocument)
			const duration = Date.now() - startTime

			expect(sections.length).toBe(50)
			expect(duration).toBeLessThan(1000) // 应该在 1 秒内完成

			console.log(`提取 ${sections.length} 个章节耗时: ${duration}ms`)
		})
	})
})
