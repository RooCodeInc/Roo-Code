/**
 * 智能内容提取器 - 为 CodeLens 提供增强的内容提取功能
 * 集成 MarkdownSectionExtractor 并提供缓存、性能优化和智能判断
 */

import * as vscode from "vscode"
import { MarkdownSectionExtractor, MarkdownSection, SectionExtractionOptions } from "./MarkdownSectionExtractor"
import { CoworkflowCommandContext, CoworkflowDocumentType, CoworkflowError } from "./types"
import { SectionExtractionErrorHandler } from "./SectionExtractionErrorHandler"

/**
 * 内容提取上下文
 */
export interface ContentExtractionContext {
	/** 文档对象 */
	document: vscode.TextDocument
	/** 文档类型 */
	documentType: CoworkflowDocumentType
	/** 行号（可选） */
	lineNumber?: number
	/** 用户选择的文本（可选） */
	selectedText?: string
	/** 是否强制提取章节 */
	forceSection?: boolean
}

/**
 * 提取结果
 */
export interface ExtractionResult {
	/** 提取的内容 */
	content: string
	/** 提取类型 */
	type: "selection" | "section" | "line" | "fallback"
	/** 章节信息（如果适用） */
	section?: MarkdownSection
	/** 是否成功 */
	success: boolean
	/** 错误信息（如果有） */
	error?: string
}

/**
 * 提取策略配置
 */
export interface ExtractionStrategy {
	/** requirements.md 的提取选项 */
	requirements: SectionExtractionOptions
	/** design.md 的提取选项 */
	design: SectionExtractionOptions
	/** tasks.md 的提取选项 */
	tasks: SectionExtractionOptions
	/** 默认提取选项 */
	default: SectionExtractionOptions
}

/**
 * 默认提取策略
 */
const DEFAULT_EXTRACTION_STRATEGY: ExtractionStrategy = {
	requirements: {
		includeHeader: true,
		includeSubsections: true,
		maxDepth: 2,
		trimEmptyLines: true,
		timeout: 3000,
	},
	design: {
		includeHeader: true,
		includeSubsections: true,
		maxDepth: 3,
		trimEmptyLines: true,
		timeout: 3000,
	},
	tasks: {
		includeHeader: false,
		includeSubsections: false,
		maxDepth: 1,
		trimEmptyLines: true,
		timeout: 2000,
	},
	default: {
		includeHeader: true,
		includeSubsections: true,
		maxDepth: 2,
		trimEmptyLines: true,
		timeout: 3000,
	},
}

/**
 * 智能内容提取器类
 */
export class SectionContentExtractor {
	private sectionExtractor: MarkdownSectionExtractor
	private extractionStrategy: ExtractionStrategy
	private performanceMetrics = new Map<string, number>()
	private errorHandler: SectionExtractionErrorHandler

	constructor(strategy: Partial<ExtractionStrategy> = {}) {
		this.sectionExtractor = new MarkdownSectionExtractor()
		this.extractionStrategy = { ...DEFAULT_EXTRACTION_STRATEGY, ...strategy }
		this.errorHandler = new SectionExtractionErrorHandler()
	}

	/**
	 * 为 CodeLens 提取内容
	 * @param context 提取上下文
	 * @returns 提取结果
	 */
	public async extractContentForCodeLens(context: ContentExtractionContext): Promise<ExtractionResult> {
		try {
			// 验证文档大小
			this.errorHandler.validateDocumentSize(context.document)

			// 使用性能监控包装提取操作
			return await this.errorHandler.monitorPerformance(
				async () => {
					// 1. 优先使用用户选择的文本
					if (context.selectedText && context.selectedText.trim()) {
						return this.createResult("selection", context.selectedText, true)
					}

					// 2. 判断是否需要提取章节
					if (this.shouldExtractSection(context)) {
						const sectionResult = await this.extractSectionContent(context)
						if (sectionResult.success) {
							return sectionResult
						}
					}

					// 3. 回退到行级别提取
					const lineResult = this.extractLineContent(context)
					if (lineResult.success) {
						return lineResult
					}

					// 4. 最终回退
					return this.createResult("fallback", "", false, "No content could be extracted")
				},
				context,
				this.getExtractionOptions(context.documentType).timeout,
			)
		} catch (error) {
			// 使用错误处理器处理错误并执行回退策略
			return await this.errorHandler.handleExtractionError(error as Error, context)
		}
	}

	/**
	 * 判断是否需要提取章节
	 * @param context 提取上下文
	 * @returns 是否需要提取章节
	 */
	public shouldExtractSection(context: ContentExtractionContext): boolean {
		// 强制提取章节
		if (context.forceSection) {
			return true
		}

		// 根据文档类型判断
		switch (context.documentType) {
			case "requirements":
			case "design":
				return this.isHeaderLine(context)
			case "tasks":
				// tasks.md 通常不需要章节提取，除非明确指定
				return false
			default:
				return this.isHeaderLine(context)
		}
	}

	/**
	 * 提取章节内容
	 * @param context 提取上下文
	 * @returns 提取结果
	 */
	private async extractSectionContent(context: ContentExtractionContext): Promise<ExtractionResult> {
		if (context.lineNumber === undefined) {
			return this.createResult("section", "", false, "Line number not provided")
		}

		// 验证行号是否为标题行
		const line = context.document.lineAt(context.lineNumber)
		const headerLevel = this.sectionExtractor.detectHeaderLevel(line.text)

		if (headerLevel === -1) {
			throw new Error("Specified line is not a valid header")
		}

		// 获取提取选项
		const options = this.getExtractionOptions(context.documentType)

		// 使用性能监控包装章节提取
		const content = await this.errorHandler.monitorPerformance(
			async () => this.sectionExtractor.getSectionContent(context.document, context.lineNumber!, options),
			context,
			options.timeout,
		)

		// 获取章节信息
		const sections = this.sectionExtractor.extractSections(context.document)
		const section = sections.find((s) => s.headerLine === context.lineNumber)

		return this.createResult("section", content, true, undefined, section)
	}

	/**
	 * 提取行内容
	 * @param context 提取上下文
	 * @returns 提取结果
	 */
	private extractLineContent(context: ContentExtractionContext): ExtractionResult {
		try {
			if (context.lineNumber === undefined) {
				return this.createResult("line", "", false, "Line number not provided")
			}

			if (context.lineNumber >= context.document.lineCount) {
				return this.createResult("line", "", false, "Line number out of range")
			}

			const line = context.document.lineAt(context.lineNumber)
			let content = line.text

			// 对于 tasks.md，尝试获取任务及其子内容
			if (context.documentType === "tasks") {
				content = this.getTaskWithSubContent(context.document, context.lineNumber)
			}

			return this.createResult("line", content, true)
		} catch (error) {
			return this.createResult(
				"line",
				"",
				false,
				`Line extraction failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * 获取任务及其子内容（从原有 commands.ts 移植）
	 */
	private getTaskWithSubContent(document: vscode.TextDocument, taskLineNumber: number): string {
		const lines: string[] = []
		const taskLine = document.lineAt(taskLineNumber)
		const taskIndent = this.getIndentLevel(taskLine.text)

		// 添加任务行本身
		lines.push(taskLine.text)

		// 查找子内容
		for (let i = taskLineNumber + 1; i < document.lineCount; i++) {
			const line = document.lineAt(i)
			const lineText = line.text.trim()

			// 跳过空行
			if (lineText === "") {
				continue
			}

			const lineIndent = this.getIndentLevel(line.text)

			// 检查是否为任务项（带状态的列表项）
			const isTaskItem = lineText.match(/^[-*]\s*\[[x\-\s]\]/)

			// 如果遇到新的任务项，停止
			if (isTaskItem) {
				break
			}

			// 如果是缩进的内容，添加到结果中
			if (lineIndent > taskIndent) {
				lines.push(line.text)
			} else if (lineIndent === taskIndent) {
				// 同级别的内容，检查是否为任务的子内容
				// 如果是以 "- " 开头但不是任务项的列表，视为子内容
				if (lineText.startsWith("- ") && !isTaskItem) {
					lines.push(line.text)
				} else {
					// 其他同级内容，停止
					break
				}
			} else {
				// 更高级别的内容，停止
				break
			}
		}

		return lines.join("\n")
	}

	/**
	 * 获取缩进级别
	 */
	private getIndentLevel(line: string): number {
		let indent = 0
		for (const char of line) {
			if (char === " ") {
				indent++
			} else if (char === "\t") {
				indent += 4 // 制表符按 4 个空格计算
			} else {
				break
			}
		}
		return indent
	}

	/**
	 * 判断是否为标题行
	 */
	private isHeaderLine(context: ContentExtractionContext): boolean {
		if (context.lineNumber === undefined) {
			return false
		}

		try {
			const line = context.document.lineAt(context.lineNumber)
			return this.sectionExtractor.detectHeaderLevel(line.text) !== -1
		} catch {
			return false
		}
	}

	/**
	 * 获取提取选项
	 */
	private getExtractionOptions(documentType: CoworkflowDocumentType): SectionExtractionOptions {
		switch (documentType) {
			case "requirements":
				return this.extractionStrategy.requirements
			case "design":
				return this.extractionStrategy.design
			case "tasks":
				return this.extractionStrategy.tasks
			default:
				return this.extractionStrategy.default
		}
	}

	/**
	 * 创建提取结果
	 */
	private createResult(
		type: ExtractionResult["type"],
		content: string,
		success: boolean,
		error?: string,
		section?: MarkdownSection,
	): ExtractionResult {
		return {
			content,
			type,
			section,
			success,
			error,
		}
	}

	/**
	 * 记录性能指标
	 */
	private recordPerformance(documentType: CoworkflowDocumentType, duration: number): void {
		const key = `${documentType}_extraction`
		const existing = this.performanceMetrics.get(key) || 0
		// 使用简单的移动平均
		const newAverage = existing === 0 ? duration : (existing + duration) / 2
		this.performanceMetrics.set(key, newAverage)
	}

	/**
	 * 获取性能指标
	 */
	public getPerformanceMetrics(): Map<string, number> {
		return new Map(this.performanceMetrics)
	}

	/**
	 * 清理缓存和指标
	 */
	public cleanup(): void {
		this.sectionExtractor.clearCache()
		this.performanceMetrics.clear()
	}

	/**
	 * 更新提取策略
	 */
	public updateStrategy(strategy: Partial<ExtractionStrategy>): void {
		this.extractionStrategy = { ...this.extractionStrategy, ...strategy }
	}

	/**
	 * 获取当前提取策略
	 */
	public getStrategy(): ExtractionStrategy {
		return { ...this.extractionStrategy }
	}

	/**
	 * 获取章节提取器实例
	 */
	public getSectionExtractor(): MarkdownSectionExtractor {
		return this.sectionExtractor
	}
}

/**
 * 从 CoworkflowCommandContext 创建 ContentExtractionContext
 */
export function createContentExtractionContext(
	commandContext: CoworkflowCommandContext,
	document: vscode.TextDocument,
	selectedText?: string,
): ContentExtractionContext {
	return {
		document,
		documentType: commandContext.documentType,
		lineNumber: commandContext.context?.lineNumber,
		selectedText,
		forceSection: false,
	}
}
