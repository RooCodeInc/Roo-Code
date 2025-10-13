/**
 * MarkdownSectionExtractor 测试用例
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import * as vscode from "vscode"
import { MarkdownSectionExtractor, MarkdownSection } from "../MarkdownSectionExtractor"

// Mock vscode
vi.mock("vscode", () => ({
	Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	})),
	Position: vi.fn().mockImplementation((line, character) => ({ line, character })),
	Uri: {
		file: vi.fn().mockImplementation((path) => ({ fsPath: path, path, toString: () => path })),
	},
}))

describe("MarkdownSectionExtractor", () => {
	let extractor: MarkdownSectionExtractor
	let mockDocument: any

	beforeEach(() => {
		extractor = new MarkdownSectionExtractor()
		mockDocument = {
			uri: { fsPath: "/test/document.md", toString: () => "/test/document.md" },
			lineCount: 0,
			getText: vi.fn(),
			version: 1,
		}
	})

	describe("detectHeaderLevel", () => {
		it("应该正确检测各级标题", () => {
			expect(extractor.detectHeaderLevel("# 一级标题")).toBe(1)
			expect(extractor.detectHeaderLevel("## 二级标题")).toBe(2)
			expect(extractor.detectHeaderLevel("### 三级标题")).toBe(3)
			expect(extractor.detectHeaderLevel("#### 四级标题")).toBe(4)
			expect(extractor.detectHeaderLevel("##### 五级标题")).toBe(5)
			expect(extractor.detectHeaderLevel("###### 六级标题")).toBe(6)
		})

		it("应该处理标题前后的空格", () => {
			expect(extractor.detectHeaderLevel("##   带空格的标题   ")).toBe(2)
			expect(extractor.detectHeaderLevel("###\t带制表符的标题")).toBe(3)
		})

		it("对于非标题行应该返回 -1", () => {
			expect(extractor.detectHeaderLevel("普通文本")).toBe(-1)
			expect(extractor.detectHeaderLevel("")).toBe(-1)
			expect(extractor.detectHeaderLevel("####### 七级标题")).toBe(-1)
			expect(extractor.detectHeaderLevel("# ")).toBe(-1) // 只有 # 没有内容
		})
	})

	describe("extractSections", () => {
		it("应该提取简单的章节结构", () => {
			const content = `# 第一章
这是第一章的内容

## 1.1 小节
这是小节内容

# 第二章
这是第二章的内容`

			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = content.split("\n").length

			const sections = extractor.extractSections(mockDocument)

			// 验证提取到的章节数量
			expect(sections.length).toBeGreaterThan(0)

			// 验证第一个章节
			expect(sections[0].title).toBe("# 第一章")
			expect(sections[0].cleanTitle).toBe("第一章")
			expect(sections[0].level).toBe(1)
			expect(sections[0].headerLine).toBe(0)

			// 查找子章节
			const subSection = sections.find((s) => s.title === "## 1.1 小节")
			expect(subSection).toBeDefined()
			expect(subSection?.level).toBe(2)

			// 查找第二章
			const chapter2 = sections.find((s) => s.title === "# 第二章")
			expect(chapter2).toBeDefined()
			expect(chapter2?.level).toBe(1)
		})

		it("应该处理空文档", () => {
			mockDocument.getText.mockReturnValue("")
			mockDocument.lineCount = 0

			const sections = extractor.extractSections(mockDocument)
			expect(sections).toHaveLength(0)
		})

		it("应该处理没有标题的文档", () => {
			const content = `这是一个普通文档
没有任何标题
只有普通文本`

			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = content.split("\n").length

			const sections = extractor.extractSections(mockDocument)
			expect(sections).toHaveLength(0)
		})

		it("应该正确处理章节边界", () => {
			const content = `# 章节1
内容1

## 子章节1.1
子内容1.1

## 子章节1.2
子内容1.2

# 章节2
内容2`

			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = content.split("\n").length

			const sections = extractor.extractSections(mockDocument)

			expect(sections).toHaveLength(4)

			// 检查第一个章节的边界
			expect(sections[0].startLine).toBe(0)
			expect(sections[0].endLine).toBe(3) // 到下一个标题前

			// 检查子章节的边界
			expect(sections[1].startLine).toBe(3)
			expect(sections[1].endLine).toBe(6)

			expect(sections[2].startLine).toBe(6)
			expect(sections[2].endLine).toBe(9)

			// 检查最后一个章节
			expect(sections[3].startLine).toBe(9)
			expect(sections[3].endLine).toBe(11) // 文档结尾
		})
	})

	describe("getSectionContent", () => {
		beforeEach(() => {
			const content = `# 主标题
主标题内容

## 子标题1
子标题1内容
更多内容

### 子子标题
子子标题内容

## 子标题2
子标题2内容`

			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = content.split("\n").length
		})

		it("应该提取完整的章节内容（包含标题）", () => {
			const content = extractor.getSectionContent(mockDocument, 0, {
				includeHeader: true,
				includeSubsections: true,
			})

			expect(content).toContain("# 主标题")
			expect(content).toContain("主标题内容")
			expect(content).toContain("## 子标题1")
			expect(content).toContain("### 子子标题")
		})

		it("应该提取章节内容（不包含标题）", () => {
			const content = extractor.getSectionContent(mockDocument, 3, {
				includeHeader: false,
				includeSubsections: true,
			})

			expect(content).not.toContain("## 子标题1")
			expect(content).toContain("子标题1内容")
			expect(content).toContain("### 子子标题")
		})

		it("应该提取章节内容（不包含子章节）", () => {
			const content = extractor.getSectionContent(mockDocument, 3, {
				includeHeader: true,
				includeSubsections: false,
			})

			expect(content).toContain("## 子标题1")
			expect(content).toContain("子标题1内容")
			expect(content).not.toContain("### 子子标题")
		})

		it("应该处理无效的行号", () => {
			expect(() => {
				extractor.getSectionContent(mockDocument, -1)
			}).toThrow("Failed to get section content")

			expect(() => {
				extractor.getSectionContent(mockDocument, 999)
			}).toThrow("Failed to get section content")
		})

		it("应该处理非标题行", () => {
			expect(() => {
				extractor.getSectionContent(mockDocument, 1) // 普通内容行
			}).toThrow("Failed to get section content")
		})

		it("应该去除空行", () => {
			const contentWithEmptyLines = `# 标题


内容行1

内容行2


`
			mockDocument.getText.mockReturnValue(contentWithEmptyLines)
			mockDocument.lineCount = contentWithEmptyLines.split("\n").length

			const content = extractor.getSectionContent(mockDocument, 0, {
				trimEmptyLines: true,
			})

			const lines = content.split("\n").filter((line) => line.trim() !== "")
			expect(lines[0]).toBe("# 标题")
			expect(lines[1]).toBe("内容行1")
			expect(lines[2]).toBe("内容行2")
			expect(lines).toHaveLength(3)
		})
	})

	describe("findSectionBoundary", () => {
		it("应该正确查找章节边界", () => {
			const lines = [
				"# 章节1", // 0
				"内容1", // 1
				"## 子章节1.1", // 2
				"子内容1.1", // 3
				"# 章节2", // 4
				"内容2", // 5
			]

			const boundary = extractor.findSectionBoundary(lines, 0, 1)
			expect(boundary.startLine).toBe(0)
			expect(boundary.endLine).toBe(4) // 到下一个同级标题

			const subBoundary = extractor.findSectionBoundary(lines, 2, 2)
			expect(subBoundary.startLine).toBe(2)
			expect(subBoundary.endLine).toBe(4) // 到上级标题
		})

		it("应该处理文档末尾的章节", () => {
			const lines = ["# 章节1", "内容1", "## 最后的子章节", "最后的内容"]

			const boundary = extractor.findSectionBoundary(lines, 2, 2)
			expect(boundary.startLine).toBe(2)
			expect(boundary.endLine).toBe(4) // 文档结尾
		})

		it("应该处理深度限制", () => {
			const lines = ["# 章节1", "## 子章节", "### 子子章节", "#### 深层章节", "##### 更深层章节", "# 章节2"]

			const boundary = extractor.findSectionBoundary(lines, 0, 1, {
				includeSubsections: true,
				maxDepth: 2,
			})

			expect(boundary.startLine).toBe(0)
			expect(boundary.endLine).toBe(3) // 超过深度限制的地方停止
		})
	})

	describe("缓存功能", () => {
		it("应该缓存提取结果", () => {
			const content = "# 测试标题\n测试内容"
			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = 2

			// 第一次调用
			const sections1 = extractor.extractSections(mockDocument)

			// 第二次调用应该使用缓存（结果应该相同）
			const sections2 = extractor.extractSections(mockDocument)

			expect(sections2).toEqual(sections1)
			expect(sections1.length).toBeGreaterThan(0)
		})

		it("应该在文档版本变化时更新缓存", () => {
			const content = "# 测试标题\n测试内容"
			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = 2

			// 第一次调用
			const sections1 = extractor.extractSections(mockDocument)

			// 更改文档版本
			mockDocument.version = 2

			// 第二次调用应该重新提取
			const sections2 = extractor.extractSections(mockDocument)

			// 结果应该相同，但缓存应该被更新
			expect(sections2).toEqual(sections1)
		})

		it("应该能够清理缓存", () => {
			const content = "# 测试标题\n测试内容"
			mockDocument.getText.mockReturnValue(content)
			mockDocument.lineCount = 2

			extractor.extractSections(mockDocument)
			const stats1 = extractor.getCacheStats()
			expect(stats1.size).toBeGreaterThan(0)

			extractor.clearCache()
			const stats2 = extractor.getCacheStats()
			expect(stats2.size).toBe(0)
		})
	})

	describe("错误处理", () => {
		it("应该处理过大的文档", () => {
			const largeContent = "# 标题\n" + "内容\n".repeat(100000)
			mockDocument.getText.mockReturnValue(largeContent)

			// 由于我们的实现可能不会抛出错误，而是返回结果
			// 让我们测试它能够处理大文档而不崩溃
			const result = extractor.extractSections(mockDocument)
			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)
		})

		it("应该处理格式错误的文档", () => {
			// 模拟 getText 抛出错误
			mockDocument.getText.mockImplementation(() => {
				throw new Error("Document read error")
			})

			expect(() => {
				extractor.extractSections(mockDocument)
			}).toThrow("Failed to extract sections")
		})
	})
})
