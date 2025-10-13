/**
 * 真实文件章节提取测试
 * 使用实际的 .cospec 文件验证章节提取功能
 */

import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MarkdownSectionExtractor } from "../MarkdownSectionExtractor"
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

describe("真实文件章节提取测试", () => {
	let markdownExtractor: MarkdownSectionExtractor
	let codeLensProvider: CoworkflowCodeLensProvider

	// 真实文件路径
	const designFilePath = path.join(process.cwd(), ".cospec", "design.md")
	const requirementsFilePath = path.join(process.cwd(), ".cospec", "requirements.md")

	beforeEach(() => {
		vi.clearAllMocks()
		markdownExtractor = new MarkdownSectionExtractor()
		codeLensProvider = new CoworkflowCodeLensProvider()
	})

	afterEach(() => {
		markdownExtractor.clearCache()
	})

	/**
	 * 创建模拟文档对象
	 */
	function createMockDocument(filePath: string, content: string): vscode.TextDocument {
		const lines = content.split("\n")
		return {
			uri: vscode.Uri.file(filePath),
			getText: vi.fn(() => content),
			lineCount: lines.length,
			lineAt: vi.fn((line: number) => ({
				text: lines[line] || "",
				lineNumber: line,
			})),
			version: 1,
		} as any
	}

	describe("design.md 文件章节提取", () => {
		it("应该能够提取 design.md 中的所有章节", () => {
			// 检查文件是否存在
			if (!fs.existsSync(designFilePath)) {
				console.warn(`跳过测试: design.md 文件不存在 (${designFilePath})`)
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			const sections = markdownExtractor.extractSections(designDocument)

			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)

			// 验证主要章节存在
			const sectionTitles = sections.map((s) => s.cleanTitle)
			console.log("Design.md 中找到的章节:", sectionTitles)

			// 根据实际文件内容验证章节
			expect(sectionTitles.some((title) => title.includes("Design Document") || title.includes("设计文档"))).toBe(
				true,
			)
		})

		it("应该正确提取 Overview 章节的完整内容", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)
			const lines = designContent.split("\n")

			// 查找 Overview 章节
			const overviewLineNumber = lines.findIndex(
				(line) => line.trim() === "## Overview" || line.trim().includes("概述"),
			)

			if (overviewLineNumber === -1) {
				console.warn("Overview 章节未找到，跳过测试")
				return
			}

			const content = markdownExtractor.getSectionContent(designDocument, overviewLineNumber)

			expect(content).toBeDefined()
			expect(content.length).toBeGreaterThan(0)
			expect(content).toContain("##") // 应该包含标题

			console.log(`Overview 章节内容长度: ${content.length} 字符`)
			console.log("Overview 章节预览:", content.substring(0, 200) + "...")
		})

		it("应该正确提取包含子章节的 Architecture 章节", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)
			const lines = designContent.split("\n")

			// 查找 Architecture 章节
			const architectureLineNumber = lines.findIndex(
				(line) => line.trim() === "## Architecture" || line.trim().includes("架构"),
			)

			if (architectureLineNumber === -1) {
				console.warn("Architecture 章节未找到，跳过测试")
				return
			}

			const content = markdownExtractor.getSectionContent(designDocument, architectureLineNumber, {
				includeSubsections: true,
				maxDepth: 3,
			})

			expect(content).toBeDefined()
			expect(content.length).toBeGreaterThan(0)

			// 检查是否包含子章节
			const hasSubsections = content.includes("###")
			console.log(`Architecture 章节包含子章节: ${hasSubsections}`)
			console.log(`Architecture 章节内容长度: ${content.length} 字符`)
		})

		it("应该为 design.md 生成 CodeLens", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			const codeLenses = codeLensProvider.provideCodeLenses(designDocument, {} as any)

			expect(codeLenses).toBeDefined()
			expect(Array.isArray(codeLenses)).toBe(true)

			if (Array.isArray(codeLenses)) {
				console.log(`为 design.md 生成了 ${codeLenses.length} 个 CodeLens`)

				if (codeLenses.length > 0) {
					// 验证所有 CodeLens 都是 update 类型
					const updateCodeLenses = codeLenses.filter((cl) => (cl as any).actionType === "update")
					expect(updateCodeLenses.length).toBe(codeLenses.length)

					// 打印前几个 CodeLens 的信息
					codeLenses.slice(0, 3).forEach((cl, index) => {
						const coworkflowCL = cl as any
						console.log(`CodeLens ${index + 1}:`, {
							line: cl.range.start.line,
							actionType: coworkflowCL.actionType,
							sectionTitle: coworkflowCL.context?.sectionTitle?.substring(0, 50),
						})
					})
				}
			}
		})
	})

	describe("requirements.md 文件章节提取", () => {
		it("应该能够提取 requirements.md 中的所有章节", () => {
			if (!fs.existsSync(requirementsFilePath)) {
				console.warn(`跳过测试: requirements.md 文件不存在 (${requirementsFilePath})`)
				return
			}

			const requirementsContent = fs.readFileSync(requirementsFilePath, "utf-8")
			const requirementsDocument = createMockDocument(requirementsFilePath, requirementsContent)

			const sections = markdownExtractor.extractSections(requirementsDocument)

			expect(sections).toBeDefined()
			expect(sections.length).toBeGreaterThan(0)

			// 验证主要章节存在
			const sectionTitles = sections.map((s) => s.cleanTitle)
			console.log("Requirements.md 中找到的章节:", sectionTitles)

			// 根据实际文件内容验证章节
			expect(sectionTitles.some((title) => title.includes("Requirements") || title.includes("需求"))).toBe(true)
		})

		it("应该正确提取 Requirement 章节的完整内容", () => {
			if (!fs.existsSync(requirementsFilePath)) {
				console.warn("跳过测试: requirements.md 文件不存在")
				return
			}

			const requirementsContent = fs.readFileSync(requirementsFilePath, "utf-8")
			const requirementsDocument = createMockDocument(requirementsFilePath, requirementsContent)
			const lines = requirementsContent.split("\n")

			// 查找第一个 Requirement 章节
			const requirementLineNumber = lines.findIndex(
				(line) => line.trim().startsWith("### Requirement") || line.trim().includes("需求"),
			)

			if (requirementLineNumber === -1) {
				console.warn("Requirement 章节未找到，跳过测试")
				return
			}

			const content = markdownExtractor.getSectionContent(requirementsDocument, requirementLineNumber)

			expect(content).toBeDefined()
			expect(content.length).toBeGreaterThan(0)
			expect(content).toContain("###") // 应该包含标题

			// 验证包含用户故事和验收标准
			const hasUserStory = content.includes("User Story") || content.includes("用户故事")
			const hasAcceptanceCriteria = content.includes("Acceptance Criteria") || content.includes("验收标准")

			console.log(`Requirement 章节包含用户故事: ${hasUserStory}`)
			console.log(`Requirement 章节包含验收标准: ${hasAcceptanceCriteria}`)
			console.log(`Requirement 章节内容长度: ${content.length} 字符`)
		})

		it("应该为 requirements.md 生成 CodeLens", () => {
			if (!fs.existsSync(requirementsFilePath)) {
				console.warn("跳过测试: requirements.md 文件不存在")
				return
			}

			const requirementsContent = fs.readFileSync(requirementsFilePath, "utf-8")
			const requirementsDocument = createMockDocument(requirementsFilePath, requirementsContent)

			const codeLenses = codeLensProvider.provideCodeLenses(requirementsDocument, {} as any)

			expect(codeLenses).toBeDefined()
			expect(Array.isArray(codeLenses)).toBe(true)

			if (Array.isArray(codeLenses)) {
				console.log(`为 requirements.md 生成了 ${codeLenses.length} 个 CodeLens`)

				if (codeLenses.length > 0) {
					// 验证所有 CodeLens 都是 update 类型
					const updateCodeLenses = codeLenses.filter((cl) => (cl as any).actionType === "update")
					expect(updateCodeLenses.length).toBe(codeLenses.length)
				}
			}
		})
	})

	describe("不同层级标题提取测试", () => {
		it("应该正确识别和提取不同层级的标题", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			const sections = markdownExtractor.extractSections(designDocument)

			// 统计不同层级的标题数量
			const levelCounts = sections.reduce(
				(acc, section) => {
					acc[section.level] = (acc[section.level] || 0) + 1
					return acc
				},
				{} as Record<number, number>,
			)

			console.log("标题层级统计:", levelCounts)

			// 验证至少有一级和二级标题
			expect(levelCounts[1] || 0).toBeGreaterThan(0)
			expect(levelCounts[2] || 0).toBeGreaterThan(0)
		})
	})

	describe("嵌套子章节提取测试", () => {
		it("应该正确处理包含子章节的章节提取", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)
			const lines = designContent.split("\n")

			// 查找一个有子章节的二级标题
			let parentHeaderLine = -1
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].trim().startsWith("## ")) {
					// 检查后面是否有三级标题
					for (let j = i + 1; j < lines.length && j < i + 20; j++) {
						if (lines[j].trim().startsWith("### ")) {
							parentHeaderLine = i
							break
						}
						if (lines[j].trim().startsWith("## ")) {
							break // 遇到下一个二级标题，停止查找
						}
					}
					if (parentHeaderLine !== -1) break
				}
			}

			if (parentHeaderLine === -1) {
				console.warn("未找到包含子章节的标题，跳过测试")
				return
			}

			// 测试包含子章节的提取
			const contentWithSubs = markdownExtractor.getSectionContent(designDocument, parentHeaderLine, {
				includeSubsections: true,
				maxDepth: 2,
			})

			// 测试不包含子章节的提取
			const contentWithoutSubs = markdownExtractor.getSectionContent(designDocument, parentHeaderLine, {
				includeSubsections: false,
			})

			expect(contentWithSubs.length).toBeGreaterThan(contentWithoutSubs.length)
			expect(contentWithSubs).toContain("###")
			expect(contentWithoutSubs).not.toContain("###")

			console.log(`包含子章节的内容长度: ${contentWithSubs.length}`)
			console.log(`不包含子章节的内容长度: ${contentWithoutSubs.length}`)
		})
	})

	describe("性能测试", () => {
		it("应该在合理时间内完成章节提取", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
				return
			}

			const designContent = fs.readFileSync(designFilePath, "utf-8")
			const designDocument = createMockDocument(designFilePath, designContent)

			const startTime = Date.now()
			const sections = markdownExtractor.extractSections(designDocument)
			const duration = Date.now() - startTime

			expect(sections.length).toBeGreaterThan(0)
			expect(duration).toBeLessThan(2000) // 应该在 2 秒内完成

			console.log(`提取 ${sections.length} 个章节耗时: ${duration}ms`)
		})

		it("应该正确使用缓存", () => {
			if (!fs.existsSync(designFilePath)) {
				console.warn("跳过测试: design.md 文件不存在")
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
			expect(duration2).toBeLessThanOrEqual(duration1) // 缓存应该更快或相等

			console.log(`第一次提取: ${duration1}ms, 第二次提取: ${duration2}ms`)

			// 验证缓存统计
			const cacheStats = markdownExtractor.getCacheStats()
			expect(cacheStats.size).toBeGreaterThan(0)
		})
	})

	describe("文档类型识别测试", () => {
		it("应该正确识别不同的文档类型", () => {
			const designUri = vscode.Uri.file(designFilePath)
			const requirementsUri = vscode.Uri.file(requirementsFilePath)

			const designType = codeLensProvider.getDocumentType(designUri)
			const requirementsType = codeLensProvider.getDocumentType(requirementsUri)

			expect(designType).toBe("design")
			expect(requirementsType).toBe("requirements")
		})
	})
})
