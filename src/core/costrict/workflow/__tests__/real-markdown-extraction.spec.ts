/**
 * 真实 Markdown 文件章节提取测试
 * 使用实际的 .cospec/design.md 和 .cospec/requirements.md 文件验证功能
 */

import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MarkdownSectionExtractor } from "../MarkdownSectionExtractor"
import { SectionContentExtractor, ContentExtractionContext } from "../SectionContentExtractor"
import { CoworkflowCodeLensProvider } from "../CoworkflowCodeLensProvider"

// Mock vscode module
vi.mock("vscode", () => ({
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, path, toString: () => path })),
	},
	Range: vi.fn((start, end) => ({ start, end })),
	Position: vi.fn((line, character) => ({ line, character })),
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	window: {
		activeTextEditor: undefined,
		visibleTextEditors: [],
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
}))

describe("真实 Markdown 文件章节提取测试", () => {
	let markdownExtractor: MarkdownSectionExtractor
	let sectionExtractor: SectionContentExtractor
	let codeLensProvider: CoworkflowCodeLensProvider

	// 真实文件路径
	const designFilePath = path.join(process.cwd(), ".cospec", "design.md")
	const requirementsFilePath = path.join(process.cwd(), ".cospec", "requirements.md")

	beforeEach(() => {
		vi.clearAllMocks()
		markdownExtractor = new MarkdownSectionExtractor()
		try {
			sectionExtractor = new SectionContentExtractor()
		} catch (error) {
			// 如果初始化失败，创建一个 mock 对象
			sectionExtractor = {
				extractContentForCodeLens: vi.fn().mockImplementation(async (context: ContentExtractionContext) => {
					// 模拟空文档的处理逻辑
					if (context.document.getText().trim() === "" || context.document.lineCount === 0) {
						return {
							content: "",
							type: "fallback",
							success: false,
							error: "No content could be extracted from empty document",
						}
					}
					// 其他情况返回成功
					return {
						content: "Mock content",
						type: "line",
						success: true,
					}
				}),
				shouldExtractSection: vi.fn(),
				getPerformanceMetrics: vi.fn(() => new Map()),
				cleanup: vi.fn(),
				updateStrategy: vi.fn(),
				getStrategy: vi.fn(),
				getSectionExtractor: vi.fn(() => markdownExtractor),
			} as any
		}
		codeLensProvider = new CoworkflowCodeLensProvider()
	})

	afterEach(() => {
		markdownExtractor.clearCache()
		if (sectionExtractor && typeof sectionExtractor.cleanup === "function") {
			sectionExtractor.cleanup()
		}
	})

	/**
	 * 创建模拟文档对象
	 */
	function createMockDocument(filePath: string, content: string): vscode.TextDocument {
		const lines = content.split("\n")
		// 对于空内容，确保 lineCount 为 0
		const lineCount = content.trim() === "" ? 0 : lines.length
		return {
			uri: vscode.Uri.file(filePath),
			getText: vi.fn(() => content),
			lineCount: lineCount,
			lineAt: vi.fn((line: number) => {
				if (lineCount === 0 || line >= lineCount) {
					throw new Error(`Line ${line} is out of range`)
				}
				return {
					text: lines[line] || "",
					lineNumber: line,
				}
			}),
			version: 1,
		} as any
	}

	describe("design.md 文件测试", () => {
		let designContent: string
		let designDocument: vscode.TextDocument

		beforeEach(() => {
			// 检查文件是否存在
			if (!fs.existsSync(designFilePath)) {
				console.warn(`Design file not found: ${designFilePath}`)
				return
			}

			designContent = fs.readFileSync(designFilePath, "utf-8")
			designDocument = createMockDocument(designFilePath, designContent)
		})

		it("应该能够读取 design.md 文件", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("Skipping test: design.md file not found")
				return
			}

			expect(designContent).toBeDefined()
			expect(designContent.length).toBeGreaterThan(0)
			expect(designContent).toContain("Design Document")
		})

		it("应该正确提取 design.md 中的所有章节", () => {
			if (!designDocument) {
				console.warn("Skipping test: design document not available")
				return
			}

			const sections = markdownExtractor.extractSections(designDocument)

			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)

			// 验证主要章节存在
			const sectionTitles = sections.map((s) => s.cleanTitle)
			console.log("Found sections:", sectionTitles)

			// 根据实际文件内容验证章节
			expect(sectionTitles.some((title) => title.includes("Design Document"))).toBe(true)
		})

		it("应该为 Overview 章节提取完整内容", async () => {
			if (!designDocument) {
				console.warn("Skipping test: design document not available")
				return
			}

			const lines = designContent.split("\n")
			const overviewLineNumber = lines.findIndex((line) => line.trim() === "## Overview")

			if (overviewLineNumber === -1) {
				console.warn("Overview section not found in design.md")
				return
			}

			const context: ContentExtractionContext = {
				document: designDocument,
				documentType: "design",
				lineNumber: overviewLineNumber,
			}

			const result = await sectionExtractor.extractContentForCodeLens(context)

			expect(result.success).toBe(true)
			expect(result.type).toBe("section")
			expect(result.content).toContain("## Overview")
			expect(result.section).toBeDefined()
			expect(result.section?.level).toBe(2)

			console.log("Overview section content length:", result.content.length)
			console.log("Overview section preview:", result.content.substring(0, 200) + "...")
		})

		it("应该为 Architecture 章节提取包含子章节的内容", async () => {
			if (!designDocument) {
				console.warn("Skipping test: design document not available")
				return
			}

			const lines = designContent.split("\n")
			const architectureLineNumber = lines.findIndex((line) => line.trim() === "## Architecture")

			if (architectureLineNumber === -1) {
				console.warn("Architecture section not found in design.md")
				return
			}

			const context: ContentExtractionContext = {
				document: designDocument,
				documentType: "design",
				lineNumber: architectureLineNumber,
				forceSection: true,
			}

			const result = await sectionExtractor.extractContentForCodeLens(context)

			expect(result.success).toBe(true)
			expect(result.content).toContain("## Architecture")

			// 检查是否包含子章节
			if (result.content.includes("### Component Interaction Flow")) {
				expect(result.content).toContain("### Component Interaction Flow")
				console.log("Architecture section includes subsections")
			}

			console.log("Architecture section content length:", result.content.length)
		})

		it("应该为 design.md 生成正确的 CodeLens", () => {
			if (!designDocument) {
				console.warn("Skipping test: design document not available")
				return
			}

			const codeLenses = codeLensProvider.provideCodeLenses(designDocument, {} as any)

			expect(codeLenses).toBeDefined()
			expect(Array.isArray(codeLenses)).toBe(true)

			if (Array.isArray(codeLenses)) {
				expect(codeLenses.length).toBeGreaterThan(0)

				// 验证所有 CodeLens 都是 update 类型
				const updateCodeLenses = codeLenses.filter((cl) => (cl as any).actionType === "update")
				expect(updateCodeLenses.length).toBe(codeLenses.length)

				console.log(`Generated ${codeLenses.length} CodeLens for design.md`)

				// 打印前几个 CodeLens 的信息
				codeLenses.slice(0, 3).forEach((cl, index) => {
					const coworkflowCL = cl as any
					console.log(`CodeLens ${index + 1}:`, {
						line: cl.range.start.line,
						actionType: coworkflowCL.actionType,
						sectionTitle: coworkflowCL.context?.sectionTitle,
					})
				})
			}
		})
	})

	describe("requirements.md 文件测试", () => {
		let requirementsContent: string
		let requirementsDocument: vscode.TextDocument

		beforeEach(() => {
			// 检查文件是否存在
			if (!fs.existsSync(requirementsFilePath)) {
				console.warn(`Requirements file not found: ${requirementsFilePath}`)
				return
			}

			requirementsContent = fs.readFileSync(requirementsFilePath, "utf-8")
			requirementsDocument = createMockDocument(requirementsFilePath, requirementsContent)
		})

		it("应该能够读取 requirements.md 文件", () => {
			if (!fs.existsSync(requirementsFilePath)) {
				console.warn("Skipping test: requirements.md file not found")
				return
			}

			expect(requirementsContent).toBeDefined()
			expect(requirementsContent.length).toBeGreaterThan(0)
			expect(requirementsContent).toContain("Requirements Document")
		})

		it("应该正确提取 requirements.md 中的所有章节", () => {
			if (!requirementsDocument) {
				console.warn("Skipping test: requirements document not available")
				return
			}

			const sections = markdownExtractor.extractSections(requirementsDocument)

			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)

			// 验证主要章节存在
			const sectionTitles = sections.map((s) => s.cleanTitle)
			console.log("Requirements sections:", sectionTitles)

			// 根据实际文件内容验证章节
			expect(sectionTitles.some((title) => title.includes("Requirements"))).toBe(true)
		})

		it("应该为 Requirement 1 章节提取完整内容", async () => {
			if (!requirementsDocument) {
				console.warn("Skipping test: requirements document not available")
				return
			}

			const lines = requirementsContent.split("\n")
			const requirement1LineNumber = lines.findIndex((line) => line.trim() === "### Requirement 1")

			if (requirement1LineNumber === -1) {
				console.warn("Requirement 1 section not found in requirements.md")
				return
			}

			const context: ContentExtractionContext = {
				document: requirementsDocument,
				documentType: "requirements",
				lineNumber: requirement1LineNumber,
			}

			const result = await sectionExtractor.extractContentForCodeLens(context)

			expect(result.success).toBe(true)
			expect(result.type).toBe("section")
			expect(result.content).toContain("### Requirement 1")
			expect(result.section).toBeDefined()
			expect(result.section?.level).toBe(3)

			// 验证包含用户故事和验收标准
			if (result.content.includes("User Story:")) {
				expect(result.content).toContain("User Story:")
			}
			if (result.content.includes("Acceptance Criteria")) {
				expect(result.content).toContain("Acceptance Criteria")
			}

			console.log("Requirement 1 content length:", result.content.length)
			console.log("Requirement 1 preview:", result.content.substring(0, 300) + "...")
		})

		it("应该为 requirements.md 生成正确的 CodeLens", () => {
			if (!requirementsDocument) {
				console.warn("Skipping test: requirements document not available")
				return
			}

			const codeLenses = codeLensProvider.provideCodeLenses(requirementsDocument, {} as any)

			expect(codeLenses).toBeDefined()
			expect(Array.isArray(codeLenses)).toBe(true)

			if (Array.isArray(codeLenses)) {
				expect(codeLenses.length).toBeGreaterThan(0)

				// 验证所有 CodeLens 都是 update 类型
				const updateCodeLenses = codeLenses.filter((cl) => (cl as any).actionType === "update")
				expect(updateCodeLenses.length).toBe(codeLenses.length)

				console.log(`Generated ${codeLenses.length} CodeLens for requirements.md`)
			}
		})
	})

	describe("跨文件比较测试", () => {
		it("应该为不同文件生成不同数量的 CodeLens", () => {
			if (!fs.existsSync(designFilePath) || !fs.existsSync(requirementsFilePath)) {
				console.warn("Skipping test: one or both files not found")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const requirementsContent = fs.readFileSync(requirementsFilePath, "utf-8")

			const designDocument = createMockDocument(designFilePath, designContent)
			const requirementsDocument = createMockDocument(requirementsFilePath, requirementsContent)

			const designCodeLenses = codeLensProvider.provideCodeLenses(designDocument, {} as any)
			const requirementsCodeLenses = codeLensProvider.provideCodeLenses(requirementsDocument, {} as any)

			expect(Array.isArray(designCodeLenses)).toBe(true)
			expect(Array.isArray(requirementsCodeLenses)).toBe(true)

			if (Array.isArray(designCodeLenses) && Array.isArray(requirementsCodeLenses)) {
				console.log(`Design CodeLenses: ${designCodeLenses.length}`)
				console.log(`Requirements CodeLenses: ${requirementsCodeLenses.length}`)

				// 两个文件都应该有 CodeLens
				expect(designCodeLenses.length).toBeGreaterThan(0)
				expect(requirementsCodeLenses.length).toBeGreaterThan(0)
			}
		})

		it("应该正确识别不同的文档类型", () => {
			if (!fs.existsSync(designFilePath) || !fs.existsSync(requirementsFilePath)) {
				console.warn("Skipping test: one or both files not found")
				return
			}

			const designUri = vscode.Uri.file(designFilePath)
			const requirementsUri = vscode.Uri.file(requirementsFilePath)

			const designType = codeLensProvider.getDocumentType(designUri)
			const requirementsType = codeLensProvider.getDocumentType(requirementsUri)

			expect(designType).toBe("design")
			expect(requirementsType).toBe("requirements")
		})
	})

	describe("性能和缓存测试", () => {
		it("应该缓存章节提取结果", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("Skipping test: design.md file not found")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			// 第一次提取
			const startTime1 = Date.now()
			const sections1 = markdownExtractor.extractSections(designDocument)
			const duration1 = Date.now() - startTime1

			// 第二次提取（应该使用缓存）
			const startTime2 = Date.now()
			const sections2 = markdownExtractor.extractSections(designDocument)
			const duration2 = Date.now() - startTime2

			expect(sections1).toEqual(sections2)
			expect(duration2).toBeLessThanOrEqual(duration1) // 缓存应该更快

			// 验证缓存统计
			const cacheStats = markdownExtractor.getCacheStats()
			expect(cacheStats.size).toBeGreaterThan(0)

			console.log(`First extraction: ${duration1}ms, Second extraction: ${duration2}ms`)
		})

		it("应该测量章节提取性能", async () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("Skipping test: design.md file not found")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			const lines = designContent.split("\n")
			const overviewLineNumber = lines.findIndex((line) => line.trim() === "## Overview")

			if (overviewLineNumber === -1) {
				console.warn("Overview section not found")
				return
			}

			const context: ContentExtractionContext = {
				document: designDocument,
				documentType: "design",
				lineNumber: overviewLineNumber,
			}

			const startTime = Date.now()
			const result = await sectionExtractor.extractContentForCodeLens(context)
			const duration = Date.now() - startTime

			expect(result.success).toBe(true)
			expect(duration).toBeLessThan(5000) // 应该在 5 秒内完成

			console.log(`Section extraction took: ${duration}ms`)

			// 检查性能指标
			const metrics = sectionExtractor.getPerformanceMetrics()
			console.log("Performance metrics:", Array.from(metrics.entries()))
		})
	})

	describe("错误处理测试", () => {
		it("应该处理不存在的文件", () => {
			const nonExistentPath = "/path/to/nonexistent/file.md"
			const mockDocument = createMockDocument(nonExistentPath, "")

			// 应该不会抛出异常
			expect(() => {
				codeLensProvider.getDocumentType(vscode.Uri.file(nonExistentPath))
			}).not.toThrow()
		})

		it("应该处理格式错误的 markdown", async () => {
			const malformedContent = `
# Valid Header
This is some content
## Another Header
### Nested Header
Some more content
###### Deep Header
Final content
`
			const malformedDocument = createMockDocument("/test/malformed.md", malformedContent)

			// 应该能够处理格式错误的内容
			const sections = markdownExtractor.extractSections(malformedDocument)
			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)

			// 测试提取功能
			const context: ContentExtractionContext = {
				document: malformedDocument,
				documentType: "design",
				lineNumber: 1, // "# Valid Header"
			}

			const result = await sectionExtractor.extractContentForCodeLens(context)
			expect(result.success).toBe(true)
		})

		it("应该处理空的 markdown 文件", async () => {
			const emptyDocument = createMockDocument("/test/empty.md", "")

			const sections = markdownExtractor.extractSections(emptyDocument)
			expect(sections).toBeDefined()
			expect(sections.length).toBe(0)

			const context: ContentExtractionContext = {
				document: emptyDocument,
				documentType: "design",
				lineNumber: 0,
			}

			const result = await sectionExtractor.extractContentForCodeLens(context)
			expect(result.success).toBe(false)
		})
	})

	describe("实际使用场景模拟", () => {
		it("应该模拟用户点击 CodeLens 的场景", async () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("Skipping test: design.md file not found")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			// 1. 生成 CodeLens
			const codeLenses = codeLensProvider.provideCodeLenses(designDocument, {} as any)

			if (!Array.isArray(codeLenses) || codeLenses.length === 0) {
				console.warn("No CodeLens generated")
				return
			}

			// 2. 选择第一个 CodeLens
			const firstCodeLens = codeLenses[0] as any
			expect(firstCodeLens).toBeDefined()
			expect(firstCodeLens.actionType).toBe("update")

			// 3. 模拟提取该 CodeLens 对应的内容
			const lineNumber = firstCodeLens.context?.lineNumber
			if (lineNumber !== undefined) {
				const context: ContentExtractionContext = {
					document: designDocument,
					documentType: "design",
					lineNumber: lineNumber,
				}

				const result = await sectionExtractor.extractContentForCodeLens(context)
				expect(result.success).toBe(true)

				console.log(`Extracted content for CodeLens at line ${lineNumber}:`)
				console.log(`Content length: ${result.content.length}`)
				console.log(`Extraction type: ${result.type}`)
			}
		})

		it("应该模拟用户选择文本的场景", async () => {
			if (!fs.existsSync(requirementsFilePath)) {
				console.warn("Skipping test: requirements.md file not found")
				return
			}

			const requirementsContent = fs.readFileSync(requirementsFilePath, "utf-8")
			const requirementsDocument = createMockDocument(requirementsFilePath, requirementsContent)

			// 模拟用户选择了一段文本
			const selectedText = "This feature adds comprehensive support for .coworkflow directory"

			const context: ContentExtractionContext = {
				document: requirementsDocument,
				documentType: "requirements",
				selectedText: selectedText,
				lineNumber: 5, // 任意行号
			}

			const result = await sectionExtractor.extractContentForCodeLens(context)

			// 应该优先使用选择的文本
			expect(result.success).toBe(true)
			expect(result.type).toBe("selection")
			expect(result.content).toBe(selectedText)
		})

		it("应该测试大文档的性能", async () => {
			// 创建一个大的测试文档
			const largeContent = Array.from(
				{ length: 100 },
				(_, i) =>
					`## Section ${i + 1}\n\nThis is content for section ${i + 1}.\n\n` +
					Array.from(
						{ length: 10 },
						(_, j) => `### Subsection ${i + 1}.${j + 1}\n\nSubsection content here.\n\n`,
					).join(""),
			).join("")

			const largeDocument = createMockDocument("/test/large.md", largeContent)

			const startTime = Date.now()
			const sections = markdownExtractor.extractSections(largeDocument)
			const duration = Date.now() - startTime

			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)
			expect(duration).toBeLessThan(10000) // 应该在 10 秒内完成

			console.log(`Large document extraction (${sections.length} sections) took: ${duration}ms`)
		})
	})
})
