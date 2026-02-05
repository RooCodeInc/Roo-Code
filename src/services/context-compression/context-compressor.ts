/**
 * Context Compressor
 *
 * Main entry point for context compression functionality.
 * Provides intelligent compression of code content while preserving
 * essential information and semantics.
 */

import type {
	ContextCompressor as IContextCompressor,
	CompressedContext,
	CompressionConfig,
	CompressionStats,
	CompressionStrategy,
	FunctionInfo,
	ClassInfo,
	ImportInfo,
	ExportInfo,
} from "./interfaces"
import { CodeStructureAnalyzer, analyzeCodeStructure } from "./code-structure-analyzer"
import { SmartSummarizer } from "./smart-summarizer"
import { CompressionStrategyFactory, compressWithStrategy, createCompressionStrategy } from "./compression-strategies"

/**
 * Default compression configuration
 */
const DEFAULT_CONFIG: CompressionConfig = {
	enabled: true,
	strategy: "balanced",
	preserveComments: true,
	preserveDocs: true,
	minRetentionRatio: 0.3,
}

/**
 * Detect language from file extension
 * @param filePath - File path
 * @returns Detected language
 */
function detectLanguage(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase()
	switch (ext) {
		case "py":
			return "python"
		case "java":
		case "kt":
			return "java"
		case "rs":
			return "rust"
		case "go":
			return "go"
		case "rb":
			return "ruby"
		case "php":
			return "php"
		case "swift":
			return "swift"
		case "c":
		case "cpp":
		case "cc":
		case "h":
		case "hpp":
			return "cpp"
		case "ts":
		case "tsx":
			return "typescript"
		case "js":
		case "jsx":
			return "javascript"
		default:
			return "typescript"
	}
}

/**
 * Estimate token count from content
 * @param content - Content to estimate
 * @returns Estimated token count
 */
function estimateTokens(content: string): number {
	if (!content) return 0
	return Math.ceil(content.length / 4)
}

/**
 * ContextCompressor class
 * Main implementation of context compression functionality
 */
export class ContextCompressor implements IContextCompressor {
	private config: CompressionConfig
	private stats: CompressionStats

	/**
	 * Create a new ContextCompressor
	 * @param config - Compression configuration
	 */
	constructor(config?: Partial<CompressionConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.stats = {
			totalCompressions: 0,
			averageCompressionRatio: 0,
			totalTokensSaved: 0,
			averageProcessingTimeMs: 0,
		}
	}

	/**
	 * Compress a context string to fit within max tokens
	 * @param context - The context string to compress
	 * @param maxTokens - Maximum tokens allowed
	 * @returns Compressed context result
	 */
	async compress(context: string, maxTokens: number): Promise<CompressedContext> {
		const startTime = Date.now()

		const originalTokens = estimateTokens(context)

		// If content fits within limit, no compression needed
		if (originalTokens <= maxTokens) {
			return {
				content: context,
				originalTokens,
				compressedTokens: originalTokens,
				compressionRatio: 0,
				preservedSections: [],
				metadata: {
					strategy: this.config.strategy,
					filesProcessed: 0,
					linesRemoved: 0,
					essentialInfoPreserved: [],
					warnings: ["No compression needed - content fits within token limit"],
				},
			}
		}

		// Perform compression
		const result = compressWithStrategy(context, maxTokens, this.config)

		// Update stats
		const processingTime = Date.now() - startTime
		this.stats.totalCompressions++
		this.stats.totalTokensSaved += result.originalTokens - result.compressedTokens
		this.stats.averageProcessingTimeMs =
			(this.stats.averageProcessingTimeMs * (this.stats.totalCompressions - 1) + processingTime) /
			this.stats.totalCompressions
		this.stats.averageCompressionRatio =
			(this.stats.averageCompressionRatio * (this.stats.totalCompressions - 1) + result.compressionRatio) /
			this.stats.totalCompressions

		return result
	}

	/**
	 * Compress file content for context
	 * @param fileContent - File content to compress
	 * @param maxTokens - Maximum tokens allowed
	 * @param filePath - Optional file path for language detection
	 * @returns Compressed file content
	 */
	async compressFile(fileContent: string, maxTokens: number, filePath?: string): Promise<string> {
		const language = filePath ? detectLanguage(filePath) : "typescript"
		const strategy = createCompressionStrategy(this.config.strategy, this.config, language)

		const result = await this.compress(fileContent, maxTokens)
		return result.content
	}

	/**
	 * Preserve structure of content
	 * @param content - Content to analyze
	 * @returns Array of preserved structural elements
	 */
	preserveStructure(content: string): string[] {
		const structure = analyzeCodeStructure(content)
		const elements: string[] = []

		// Add imports
		for (const imp of structure.imports) {
			elements.push(`import ${imp.importedNames.join(", ")} from '${imp.path}'`)
		}

		// Add exports
		for (const exp of structure.exports) {
			elements.push(`export ${exp.exportedName}`)
		}

		// Add class definitions
		for (const cls of structure.classes) {
			elements.push(`class ${cls.name}`)
		}

		// Add function signatures
		for (const func of structure.functions) {
			elements.push(`function ${func.name}`)
		}

		return elements
	}

	/**
	 * Summarize a code section
	 * @param section - Code section to summarize
	 * @returns Summarized section
	 */
	summarizeSection(section: string): string {
		const summarizer = new SmartSummarizer(this.config)
		const result = summarizer.summarizeFile(section)

		const parts: string[] = []

		if (result.preservedImports) {
			parts.push(result.preservedImports)
		}

		for (const cls of result.summarizedClasses) {
			parts.push(cls.classDefinition)
		}

		for (const func of result.summarizedFunctions) {
			parts.push(func.summary)
		}

		if (result.preservedExports) {
			parts.push(result.preservedExports)
		}

		return parts.join("\n\n")
	}

	/**
	 * Get compression statistics
	 * @returns Compression statistics
	 */
	getCompressionStats(): CompressionStats {
		return { ...this.stats }
	}

	/**
	 * Update compression configuration
	 * @param config - New configuration
	 */
	updateConfig(config: Partial<CompressionConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Get current configuration
	 * @returns Current configuration
	 */
	getConfig(): CompressionConfig {
		return { ...this.config }
	}

	/**
	 * Check if compression is enabled
	 * @returns True if compression is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Enable/disable compression
	 * @param enabled - Enable or disable compression
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
	}

	/**
	 * Set compression strategy
	 * @param strategy - Strategy to use
	 */
	setStrategy(strategy: CompressionStrategy): void {
		this.config.strategy = strategy
	}

	/**
	 * Get compression strategy
	 * @returns Current strategy
	 */
	getStrategy(): CompressionStrategy {
		return this.config.strategy
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			totalCompressions: 0,
			averageCompressionRatio: 0,
			totalTokensSaved: 0,
			averageProcessingTimeMs: 0,
		}
	}

	/**
	 * Extract functions from content
	 * @param content - Content to analyze
	 * @param language - Programming language
	 * @returns Array of FunctionInfo
	 */
	extractFunctions(content: string, language?: string): FunctionInfo[] {
		const analyzer = new CodeStructureAnalyzer(language)
		return analyzer.extractFunctions(content)
	}

	/**
	 * Extract classes from content
	 * @param content - Content to analyze
	 * @param language - Programming language
	 * @returns Array of ClassInfo
	 */
	extractClasses(content: string, language?: string): ClassInfo[] {
		const analyzer = new CodeStructureAnalyzer(language)
		return analyzer.extractClasses(content)
	}

	/**
	 * Extract imports from content
	 * @param content - Content to analyze
	 * @returns Array of ImportInfo
	 */
	extractImports(content: string): ImportInfo[] {
		const analyzer = new CodeStructureAnalyzer()
		return analyzer.extractImports(content)
	}

	/**
	 * Extract exports from content
	 * @param content - Content to analyze
	 * @returns Array of ExportInfo
	 */
	extractExports(content: string): ExportInfo[] {
		const analyzer = new CodeStructureAnalyzer()
		return analyzer.extractExports(content)
	}
}

/**
 * Create a default ContextCompressor instance
 * @returns ContextCompressor instance
 */
export function createDefaultCompressor(): ContextCompressor {
	return new ContextCompressor()
}

/**
 * Create a ContextCompressor with specific strategy
 * @param strategy - Compression strategy
 * @returns ContextCompressor instance
 */
export function createCompressorWithStrategy(strategy: CompressionStrategy): ContextCompressor {
	return new ContextCompressor({ strategy, enabled: true })
}

/**
 * Create an aggressive ContextCompressor
 * @returns ContextCompressor instance with aggressive strategy
 */
export function createAggressiveCompressor(): ContextCompressor {
	return createCompressorWithStrategy("aggressive")
}

/**
 * Create a preservative ContextCompressor
 * @returns ContextCompressor instance with preservative strategy
 */
export function createPreservativeCompressor(): ContextCompressor {
	return createCompressorWithStrategy("preservative")
}
