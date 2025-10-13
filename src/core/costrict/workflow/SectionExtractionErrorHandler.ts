/**
 * 章节提取错误处理和回退机制
 * 提供健壮的错误处理、性能监控和智能回退策略
 */

import * as vscode from "vscode"
import { ExtractionResult, ContentExtractionContext } from "./SectionContentExtractor"
import { createLogger, ILogger } from "../../../utils/logger"

/**
 * 错误类型枚举
 */
export enum SectionExtractionErrorType {
	TIMEOUT = "timeout",
	DOCUMENT_TOO_LARGE = "document_too_large",
	INVALID_HEADER = "invalid_header",
	PARSING_FAILED = "parsing_failed",
	CACHE_ERROR = "cache_error",
	MEMORY_ERROR = "memory_error",
	UNKNOWN = "unknown",
}

/**
 * 回退策略枚举
 */
export enum FallbackStrategy {
	LEGACY_EXTRACTION = "legacy_extraction",
	LINE_ONLY = "line_only",
	SELECTION_ONLY = "selection_only",
	EMPTY_CONTENT = "empty_content",
}

/**
 * 错误统计信息
 */
export interface ErrorStatistics {
	/** 总错误数 */
	totalErrors: number
	/** 按类型分组的错误数 */
	errorsByType: Map<SectionExtractionErrorType, number>
	/** 按文档类型分组的错误数 */
	errorsByDocumentType: Map<string, number>
	/** 回退策略使用统计 */
	fallbackUsage: Map<FallbackStrategy, number>
	/** 最近错误时间 */
	lastErrorTime?: Date
}

/**
 * 性能监控配置
 */
export interface PerformanceConfig {
	/** 慢查询阈值（毫秒） */
	slowQueryThreshold: number
	/** 超时阈值（毫秒） */
	timeoutThreshold: number
	/** 内存使用阈值（字节） */
	memoryThreshold: number
	/** 是否启用详细日志 */
	enableVerboseLogging: boolean
}

/**
 * 默认性能配置
 */
const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
	slowQueryThreshold: 1000,
	timeoutThreshold: 5000,
	memoryThreshold: 10 * 1024 * 1024, // 10MB
	enableVerboseLogging: false,
}

/**
 * 章节提取错误处理器
 */
export class SectionExtractionErrorHandler {
	private errorStats: ErrorStatistics
	private performanceConfig: PerformanceConfig
	private outputChannel: ILogger

	constructor(config: Partial<PerformanceConfig> = {}) {
		this.performanceConfig = { ...DEFAULT_PERFORMANCE_CONFIG, ...config }
		this.errorStats = {
			totalErrors: 0,
			errorsByType: new Map(),
			errorsByDocumentType: new Map(),
			fallbackUsage: new Map(),
		}
		this.outputChannel = createLogger()
	}

	/**
	 * 处理章节提取错误
	 * @param error 错误对象
	 * @param context 提取上下文
	 * @returns 回退提取结果
	 */
	public async handleExtractionError(error: Error, context: ContentExtractionContext): Promise<ExtractionResult> {
		const errorType = this.classifyError(error)
		const fallbackStrategy = this.determineFallbackStrategy(errorType, context)

		// 记录错误统计
		this.recordError(errorType, context.documentType, fallbackStrategy)

		// 记录详细错误信息
		this.logError(error, errorType, context, fallbackStrategy)

		// 执行回退策略
		return await this.executeFallbackStrategy(fallbackStrategy, context, error)
	}

	/**
	 * 监控性能并处理超时
	 * @param operation 操作函数
	 * @param context 上下文
	 * @param timeout 超时时间
	 * @returns 操作结果
	 */
	public async monitorPerformance<T>(
		operation: () => Promise<T>,
		context: ContentExtractionContext,
		timeout?: number,
	): Promise<T> {
		const startTime = Date.now()
		const timeoutMs = timeout || this.performanceConfig.timeoutThreshold

		try {
			// 创建超时 Promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Operation timeout after ${timeoutMs}ms`))
				}, timeoutMs)
			})

			// 执行操作并监控超时
			const result = await Promise.race([operation(), timeoutPromise])

			// 检查性能
			const duration = Date.now() - startTime
			if (duration > this.performanceConfig.slowQueryThreshold) {
				this.logSlowQuery(context, duration)
			}

			return result
		} catch (error) {
			const duration = Date.now() - startTime

			if (error instanceof Error && error.message.includes("timeout")) {
				throw new Error(`Section extraction timeout after ${duration}ms`)
			}

			throw error
		}
	}

	/**
	 * 检查文档大小限制
	 * @param document 文档对象
	 * @throws 如果文档过大
	 */
	public validateDocumentSize(document: vscode.TextDocument): void {
		const size = document.getText().length
		if (size > this.performanceConfig.memoryThreshold) {
			throw new Error(`Document too large: ${size} bytes (max: ${this.performanceConfig.memoryThreshold})`)
		}
	}

	/**
	 * 获取错误统计信息
	 */
	public getErrorStatistics(): ErrorStatistics {
		return {
			...this.errorStats,
			errorsByType: new Map(this.errorStats.errorsByType),
			errorsByDocumentType: new Map(this.errorStats.errorsByDocumentType),
			fallbackUsage: new Map(this.errorStats.fallbackUsage),
		}
	}

	/**
	 * 重置错误统计
	 */
	public resetStatistics(): void {
		this.errorStats = {
			totalErrors: 0,
			errorsByType: new Map(),
			errorsByDocumentType: new Map(),
			fallbackUsage: new Map(),
		}
	}

	/**
	 * 更新性能配置
	 */
	public updatePerformanceConfig(config: Partial<PerformanceConfig>): void {
		this.performanceConfig = { ...this.performanceConfig, ...config }
	}

	/**
	 * 分类错误类型
	 */
	private classifyError(error: Error): SectionExtractionErrorType {
		const message = error.message.toLowerCase()

		if (message.includes("timeout")) {
			return SectionExtractionErrorType.TIMEOUT
		}
		if (message.includes("too large") || message.includes("memory")) {
			return SectionExtractionErrorType.DOCUMENT_TOO_LARGE
		}
		if (message.includes("invalid header") || message.includes("not a header")) {
			return SectionExtractionErrorType.INVALID_HEADER
		}
		if (message.includes("parsing") || message.includes("parse")) {
			return SectionExtractionErrorType.PARSING_FAILED
		}
		if (message.includes("cache")) {
			return SectionExtractionErrorType.CACHE_ERROR
		}

		return SectionExtractionErrorType.UNKNOWN
	}

	/**
	 * 确定回退策略
	 */
	private determineFallbackStrategy(
		errorType: SectionExtractionErrorType,
		context: ContentExtractionContext,
	): FallbackStrategy {
		// 如果有用户选择的文本，优先使用
		if (context.selectedText && context.selectedText.trim()) {
			return FallbackStrategy.SELECTION_ONLY
		}

		// 根据错误类型选择策略
		switch (errorType) {
			case SectionExtractionErrorType.TIMEOUT:
			case SectionExtractionErrorType.DOCUMENT_TOO_LARGE:
				return FallbackStrategy.LINE_ONLY

			case SectionExtractionErrorType.INVALID_HEADER:
			case SectionExtractionErrorType.PARSING_FAILED:
				return FallbackStrategy.LEGACY_EXTRACTION

			case SectionExtractionErrorType.CACHE_ERROR:
			case SectionExtractionErrorType.MEMORY_ERROR:
				return FallbackStrategy.LINE_ONLY

			default:
				return FallbackStrategy.LEGACY_EXTRACTION
		}
	}

	/**
	 * 执行回退策略
	 */
	private async executeFallbackStrategy(
		strategy: FallbackStrategy,
		context: ContentExtractionContext,
		originalError: Error,
	): Promise<ExtractionResult> {
		try {
			switch (strategy) {
				case FallbackStrategy.SELECTION_ONLY:
					return {
						content: context.selectedText || "",
						type: "selection",
						success: true,
					}

				case FallbackStrategy.LINE_ONLY:
					return this.extractLineOnly(context)

				case FallbackStrategy.LEGACY_EXTRACTION:
					return this.executeLegacyExtraction(context)

				case FallbackStrategy.EMPTY_CONTENT:
				default:
					return {
						content: "",
						type: "fallback",
						success: false,
						error: `Fallback failed: ${originalError.message}`,
					}
			}
		} catch (fallbackError) {
			return {
				content: "",
				type: "fallback",
				success: false,
				error: `All fallback strategies failed. Original: ${originalError.message}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
			}
		}
	}

	/**
	 * 仅提取行内容
	 */
	private extractLineOnly(context: ContentExtractionContext): ExtractionResult {
		if (context.lineNumber === undefined || context.lineNumber >= context.document.lineCount) {
			return {
				content: "",
				type: "line",
				success: false,
				error: "Invalid line number",
			}
		}

		const line = context.document.lineAt(context.lineNumber)
		return {
			content: line.text,
			type: "line",
			success: true,
		}
	}

	/**
	 * 执行传统提取方法
	 */
	private executeLegacyExtraction(context: ContentExtractionContext): ExtractionResult {
		// 这里可以实现简化的传统提取逻辑
		// 暂时返回行内容作为回退
		return this.extractLineOnly(context)
	}

	/**
	 * 记录错误统计
	 */
	private recordError(
		errorType: SectionExtractionErrorType,
		documentType: string,
		fallbackStrategy: FallbackStrategy,
	): void {
		this.errorStats.totalErrors++
		this.errorStats.lastErrorTime = new Date()

		// 按错误类型统计
		const typeCount = this.errorStats.errorsByType.get(errorType) || 0
		this.errorStats.errorsByType.set(errorType, typeCount + 1)

		// 按文档类型统计
		const docTypeCount = this.errorStats.errorsByDocumentType.get(documentType) || 0
		this.errorStats.errorsByDocumentType.set(documentType, docTypeCount + 1)

		// 回退策略使用统计
		const fallbackCount = this.errorStats.fallbackUsage.get(fallbackStrategy) || 0
		this.errorStats.fallbackUsage.set(fallbackStrategy, fallbackCount + 1)
	}

	/**
	 * 记录错误日志
	 */
	private logError(
		error: Error,
		errorType: SectionExtractionErrorType,
		context: ContentExtractionContext,
		fallbackStrategy: FallbackStrategy,
	): void {
		const timestamp = new Date().toISOString()
		const logMessage = [
			`[${timestamp}] Section Extraction Error`,
			`Type: ${errorType}`,
			`Document: ${context.document.uri.path}`,
			`Document Type: ${context.documentType}`,
			`Line: ${context.lineNumber}`,
			`Fallback Strategy: ${fallbackStrategy}`,
			`Error: ${error.message}`,
			`Stack: ${error.stack || "N/A"}`,
			"---",
		].join("\n")

		this.outputChannel.info(logMessage)

		if (this.performanceConfig.enableVerboseLogging) {
			console.error("SectionExtractionErrorHandler:", logMessage)
		}
	}

	/**
	 * 记录慢查询日志
	 */
	private logSlowQuery(context: ContentExtractionContext, duration: number): void {
		const logMessage = [
			`[${new Date().toISOString()}] Slow Section Extraction`,
			`Duration: ${duration}ms`,
			`Document: ${context.document.uri.path}`,
			`Document Type: ${context.documentType}`,
			`Line: ${context.lineNumber}`,
			`Document Size: ${context.document.getText().length} chars`,
			"---",
		].join("\n")

		this.outputChannel.info(logMessage)

		if (this.performanceConfig.enableVerboseLogging) {
			console.warn("SectionExtractionErrorHandler:", logMessage)
		}
	}
}
