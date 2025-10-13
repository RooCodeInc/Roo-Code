/**
 * Markdown 章节提取器 - 核心章节解析引擎
 * 提供 Markdown 文档的章节识别、内容提取和边界检测功能
 */

import * as vscode from "vscode"
import { CoworkflowError, CoworkflowErrorSeverity, CoworkflowErrorType } from "./types"

/**
 * 章节信息接口
 */
export interface MarkdownSection {
	/** 章节标题（包含 # 符号） */
	title: string
	/** 章节标题（不包含 # 符号） */
	cleanTitle: string
	/** 标题行号（0-based） */
	headerLine: number
	/** 标题级别（1-6） */
	level: number
	/** 章节开始行号（标题行） */
	startLine: number
	/** 章节结束行号（不包含） */
	endLine: number
	/** 章节完整内容（包含标题） */
	content: string
	/** 章节内容（不包含标题） */
	bodyContent: string
	/** 文本范围 */
	range: vscode.Range
}

/**
 * 章节提取选项
 */
export interface SectionExtractionOptions {
	/** 是否包含标题行 */
	includeHeader?: boolean
	/** 是否包含子章节 */
	includeSubsections?: boolean
	/** 最大提取深度（相对于当前章节） */
	maxDepth?: number
	/** 是否去除空行 */
	trimEmptyLines?: boolean
	/** 超时时间（毫秒） */
	timeout?: number
}

/**
 * 默认提取选项
 */
const DEFAULT_EXTRACTION_OPTIONS: Required<SectionExtractionOptions> = {
	includeHeader: true,
	includeSubsections: true,
	maxDepth: 3,
	trimEmptyLines: true,
	timeout: 5000,
}

/**
 * Markdown 章节提取器类
 */
export class MarkdownSectionExtractor {
	private static readonly HEADER_REGEX = /^(#{1,6})\s+(.+)$/
	private static readonly MAX_DOCUMENT_SIZE = 1024 * 1024 // 1MB
	private static readonly CACHE_SIZE = 50

	private sectionCache = new Map<string, MarkdownSection[]>()
	private lastCacheCleanup = Date.now()

	/**
	 * 提取文档中的所有章节
	 * @param document VS Code 文档对象
	 * @returns 章节信息数组
	 */
	public extractSections(document: vscode.TextDocument): MarkdownSection[] {
		try {
			// 检查文档大小限制
			this.validateDocumentSize(document)

			// 检查缓存
			const cacheKey = this.getCacheKey(document)
			const cached = this.sectionCache.get(cacheKey)
			if (cached) {
				return cached
			}

			const sections: MarkdownSection[] = []
			const lines = this.getDocumentLines(document)

			// 查找所有标题行
			const headerLines = this.findHeaderLines(lines)

			// 为每个标题创建章节信息
			for (let i = 0; i < headerLines.length; i++) {
				const headerInfo = headerLines[i]
				const nextHeaderLine = i < headerLines.length - 1 ? headerLines[i + 1].lineNumber : lines.length

				const section = this.createSection(document, lines, headerInfo, nextHeaderLine)

				if (section) {
					sections.push(section)
				}
			}

			// 缓存结果
			this.cacheResult(cacheKey, sections)

			return sections
		} catch (error) {
			throw this.createError(
				"parsing_error",
				"error",
				"Failed to extract sections from document",
				error as Error,
				document.uri,
			)
		}
	}

	/**
	 * 获取指定标题行的完整章节内容
	 * @param document VS Code 文档对象
	 * @param headerLine 标题行号（0-based）
	 * @param options 提取选项
	 * @returns 章节内容字符串
	 */
	public getSectionContent(
		document: vscode.TextDocument,
		headerLine: number,
		options: SectionExtractionOptions = {},
	): string {
		try {
			const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options }

			// 设置超时
			const startTime = Date.now()
			const checkTimeout = () => {
				if (Date.now() - startTime > opts.timeout) {
					throw new Error(`Section extraction timeout after ${opts.timeout}ms`)
				}
			}

			// 验证行号
			if (headerLine < 0 || headerLine >= document.lineCount) {
				throw new Error(`Invalid header line number: ${headerLine}`)
			}

			const lines = this.getDocumentLines(document)
			const headerText = lines[headerLine]

			// 验证是否为标题行
			const headerLevel = this.detectHeaderLevel(headerText)
			if (headerLevel === -1) {
				throw new Error(`Line ${headerLine} is not a valid header`)
			}

			checkTimeout()

			// 查找章节边界
			const { startLine, endLine } = this.findSectionBoundary(lines, headerLine, headerLevel, opts)

			checkTimeout()

			// 提取内容
			let contentLines = lines.slice(startLine, endLine)

			// 处理选项
			if (!opts.includeHeader && startLine === headerLine) {
				contentLines = contentLines.slice(1)
			}

			if (opts.trimEmptyLines) {
				contentLines = this.trimEmptyLines(contentLines)
			}

			return contentLines.join("\n")
		} catch (error) {
			throw this.createError(
				"parsing_error",
				"error",
				`Failed to get section content for line ${headerLine}`,
				error as Error,
				document.uri,
			)
		}
	}

	/**
	 * 检测标题级别
	 * @param line 文本行
	 * @returns 标题级别（1-6），如果不是标题返回 -1
	 */
	public detectHeaderLevel(line: string): number {
		const match = line.match(MarkdownSectionExtractor.HEADER_REGEX)
		return match ? match[1].length : -1
	}

	/**
	 * 查找章节边界
	 * @param lines 文档行数组
	 * @param startLine 起始行号
	 * @param headerLevel 标题级别
	 * @param options 提取选项
	 * @returns 章节边界信息
	 */
	public findSectionBoundary(
		lines: string[],
		startLine: number,
		headerLevel: number,
		options: SectionExtractionOptions = {},
	): { startLine: number; endLine: number } {
		const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options }

		let endLine = lines.length

		// 从下一行开始查找结束位置
		for (let i = startLine + 1; i < lines.length; i++) {
			const currentLevel = this.detectHeaderLevel(lines[i])

			if (currentLevel !== -1) {
				// 遇到同级或更高级别的标题，结束当前章节
				if (currentLevel <= headerLevel) {
					endLine = i
					break
				}

				// 如果不包含子章节，遇到任何标题都结束
				if (!opts.includeSubsections) {
					endLine = i
					break
				}

				// 检查深度限制
				const depthDiff = currentLevel - headerLevel
				if (depthDiff > opts.maxDepth) {
					endLine = i
					break
				}
			}
		}

		return { startLine, endLine }
	}

	/**
	 * 清理缓存
	 */
	public clearCache(): void {
		this.sectionCache.clear()
		this.lastCacheCleanup = Date.now()
	}

	/**
	 * 获取缓存统计信息
	 */
	public getCacheStats(): { size: number; lastCleanup: Date } {
		return {
			size: this.sectionCache.size,
			lastCleanup: new Date(this.lastCacheCleanup),
		}
	}

	/**
	 * 验证文档大小
	 */
	private validateDocumentSize(document: vscode.TextDocument): void {
		const size = document.getText().length
		if (size > MarkdownSectionExtractor.MAX_DOCUMENT_SIZE) {
			throw new Error(`Document too large: ${size} bytes (max: ${MarkdownSectionExtractor.MAX_DOCUMENT_SIZE})`)
		}
	}

	/**
	 * 获取文档行数组
	 */
	private getDocumentLines(document: vscode.TextDocument): string[] {
		return document.getText().split("\n")
	}

	/**
	 * 查找所有标题行
	 */
	private findHeaderLines(lines: string[]): Array<{ lineNumber: number; level: number; title: string }> {
		const headerLines: Array<{ lineNumber: number; level: number; title: string }> = []

		for (let i = 0; i < lines.length; i++) {
			const level = this.detectHeaderLevel(lines[i])
			if (level !== -1) {
				const match = lines[i].match(MarkdownSectionExtractor.HEADER_REGEX)
				if (match) {
					headerLines.push({
						lineNumber: i,
						level,
						title: match[2].trim(),
					})
				}
			}
		}

		return headerLines
	}

	/**
	 * 创建章节信息对象
	 */
	private createSection(
		document: vscode.TextDocument,
		lines: string[],
		headerInfo: { lineNumber: number; level: number; title: string },
		nextHeaderLine: number,
	): MarkdownSection | null {
		try {
			const startLine = headerInfo.lineNumber
			const endLine = nextHeaderLine
			const headerText = lines[startLine]

			// 提取内容
			const contentLines = lines.slice(startLine, endLine)
			const content = contentLines.join("\n")
			const bodyContent = contentLines.slice(1).join("\n")

			// 创建范围
			const range = new vscode.Range(
				new vscode.Position(startLine, 0),
				new vscode.Position(endLine - 1, lines[endLine - 1]?.length || 0),
			)

			return {
				title: headerText,
				cleanTitle: headerInfo.title,
				headerLine: startLine,
				level: headerInfo.level,
				startLine,
				endLine,
				content,
				bodyContent,
				range,
			}
		} catch (error) {
			console.warn(`Failed to create section for line ${headerInfo.lineNumber}:`, error)
			return null
		}
	}

	/**
	 * 去除首尾空行
	 */
	private trimEmptyLines(lines: string[]): string[] {
		let start = 0
		let end = lines.length

		// 去除开头的空行
		while (start < lines.length && lines[start].trim() === "") {
			start++
		}

		// 去除结尾的空行
		while (end > start && lines[end - 1].trim() === "") {
			end--
		}

		return lines.slice(start, end)
	}

	/**
	 * 获取缓存键
	 */
	private getCacheKey(document: vscode.TextDocument): string {
		return `${document.uri.toString()}_${document.version}`
	}

	/**
	 * 缓存结果
	 */
	private cacheResult(key: string, sections: MarkdownSection[]): void {
		// 清理过期缓存
		if (this.sectionCache.size >= MarkdownSectionExtractor.CACHE_SIZE) {
			const oldestKey = this.sectionCache.keys().next().value
			if (oldestKey) {
				this.sectionCache.delete(oldestKey)
			}
		}

		this.sectionCache.set(key, sections)
	}

	/**
	 * 创建错误对象
	 */
	private createError(
		type: CoworkflowErrorType,
		severity: CoworkflowErrorSeverity,
		message: string,
		originalError?: Error,
		uri?: vscode.Uri,
	): CoworkflowError {
		return {
			type,
			severity,
			message,
			details: originalError?.message,
			uri,
			originalError,
			timestamp: new Date(),
		}
	}
}
