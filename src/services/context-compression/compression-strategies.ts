/**
 * Compression Strategies
 *
 * Implements different compression strategies for context compression:
 * - Aggressive: Maximum compression, removes all non-essential content
 * - Balanced: Middle ground between aggressive and preservative
 * - Preservative: Preserves as much information as possible
 */

import type {
	CompressionConfig,
	CompressionStrategy,
	SummarizedFile,
	SummarizedFunction,
	FunctionInfo,
	ClassInfo,
	ImportInfo,
	ExportInfo,
	CompressedContext,
	CompressionMetadata,
} from "./interfaces"
import { CodeStructureAnalyzer } from "./code-structure-analyzer"
import { SmartSummarizer } from "./smart-summarizer"

/**
 * Pattern for single-line comments
 */
const SINGLE_LINE_COMMENT = /\/\/.*$/gm

/**
 * Pattern for multi-line comments
 */
const MULTI_LINE_COMMENT = /\/\*[\s\S]*?\*\//g

/**
 * Pattern for doc comments
 */
const DOC_COMMENT = /\/\*\*[\s\S]*?\*\//g

/**
 * Pattern for blank lines
 */
const BLANK_LINE = /^\s*[\r\n]/gm

/**
 * Pattern for whitespace
 */
const WHITESPACE = /\s+/g

/**
 * Base compression strategy class
 */
abstract class BaseCompressionStrategy {
	protected config: CompressionConfig
	protected language: string

	/**
	 * Create a new compression strategy
	 * @param config - Compression configuration
	 * @param language - Programming language
	 */
	constructor(config: CompressionConfig, language: string) {
		this.config = config
		this.language = language
	}

	/**
	 * Compress content using this strategy
	 * @param content - Content to compress
	 * @param maxTokens - Maximum tokens allowed
	 * @returns Compressed content
	 */
	abstract compress(content: string, maxTokens: number): string

	/**
	 * Get the strategy type
	 */
	abstract getStrategyType(): CompressionStrategy

	/**
	 * Remove all comments from content
	 */
	protected removeAllComments(content: string): string {
		return content.replace(SINGLE_LINE_COMMENT, "").replace(MULTI_LINE_COMMENT, "")
	}

	/**
	 * Remove doc comments from content
	 */
	protected removeDocComments(content: string): string {
		return content.replace(DOC_COMMENT, "")
	}

	/**
	 * Remove blank lines from content
	 */
	protected removeBlankLines(content: string): string {
		return content.replace(BLANK_LINE, "\n").replace(/\n{3,}/g, "\n\n")
	}

	/**
	 * Collapse whitespace in content
	 */
	protected collapseWhitespace(content: string): string {
		return content.replace(WHITESPACE, " ").replace(/\s*([{}()\[\];,:])\s*/g, "$1")
	}

	/**
	 * Estimate token count (rough approximation: 4 chars per token)
	 */
	protected estimateTokens(content: string): number {
		return Math.ceil(content.length / 4)
	}

	/**
	 * Check if content needs compression
	 */
	protected needsCompression(content: string, maxTokens: number): boolean {
		return this.estimateTokens(content) > maxTokens
	}
}

/**
 * Aggressive compression strategy
 * Removes all non-essential content for maximum compression
 */
class AggressiveCompressionStrategy extends BaseCompressionStrategy {
	getStrategyType(): CompressionStrategy {
		return "aggressive"
	}

	compress(content: string, maxTokens: number): string {
		if (!this.needsCompression(content, maxTokens)) {
			return content
		}

		let compressed = content

		// Step 1: Remove all comments
		compressed = this.removeAllComments(compressed)

		// Step 2: Remove doc comments
		compressed = this.removeDocComments(compressed)

		// Step 3: Analyze structure and extract essential elements
		const analyzer = new CodeStructureAnalyzer(this.language)
		const functions = analyzer.extractFunctions(content)
		const classes = analyzer.extractClasses(content)
		const imports = analyzer.extractImports(content)
		const exports = analyzer.extractExports(content)

		// Step 4: Build compressed content
		const lines: string[] = []

		// Preserve essential imports (grouped)
		if (imports.length > 0) {
			const grouped = this.groupImports(imports)
			for (const [path, imps] of Object.entries(grouped)) {
				const names = imps.map((i) => i.importedNames[0]).filter(Boolean)
				if (names.length > 0) {
					lines.push(`import { ${names.slice(0, 3).join(", ")} } from '${path}';`)
				}
			}
			lines.push("")
		}

		// Preserve class signatures and summarize bodies
		for (const cls of classes) {
			lines.push(this.compressClass(cls))
			lines.push("")
		}

		// Preserve function signatures and summarize bodies
		for (const func of functions) {
			if (!classes.some((c) => func.startLine >= c.startLine && func.startLine <= c.endLine)) {
				lines.push(this.compressFunction(func))
				lines.push("")
			}
		}

		// Preserve exports
		if (exports.length > 0) {
			const named = exports.filter((e) => e.exportType === "named")
			if (named.length > 0) {
				lines.push(`export { ${named.map((e) => e.exportedName).join(", ")} };`)
			}
		}

		compressed = lines.join("\n")

		// Step 5: Final cleanup
		compressed = this.collapseWhitespace(compressed)
		compressed = this.removeBlankLines(compressed)

		return compressed
	}

	/**
	 * Compress a class
	 */
	private compressClass(cls: ClassInfo): string {
		const lines: string[] = []
		lines.push(`class ${cls.name} {`)

		// Keep only essential properties (first 3)
		for (const prop of cls.properties.slice(0, 3)) {
			lines.push(`  ${prop.accessModifier || ""} ${prop.name}: ${prop.type};`)
		}

		// Summarize methods
		for (const method of cls.methods.slice(0, 5)) {
			lines.push(`  ${this.compressFunction(method)}`)
		}

		if (cls.methods.length > 5) {
			lines.push(`  // ... ${cls.methods.length - 5} more methods`)
		}

		lines.push("}")
		return lines.join("\n")
	}

	/**
	 * Compress a function
	 */
	private compressFunction(func: FunctionInfo): string {
		const bodyLines = func.body.split("\n").length

		if (bodyLines <= 3) {
			return func.signature + " " + func.body
		}

		// Keep signature and a summary marker
		return func.signature + " { /* ${bodyLines} lines condensed */ }"
	}

	/**
	 * Group imports by package
	 */
	private groupImports(imports: ImportInfo[]): Record<string, ImportInfo[]> {
		const grouped: Record<string, ImportInfo[]> = {}

		for (const imp of imports) {
			const packageName = imp.path.split("/")[0] || imp.path
			if (!grouped[packageName]) {
				grouped[packageName] = []
			}
			grouped[packageName].push(imp)
		}

		return grouped
	}
}

/**
 * Balanced compression strategy
 * Middle ground between aggressive and preservative
 */
class BalancedCompressionStrategy extends BaseCompressionStrategy {
	getStrategyType(): CompressionStrategy {
		return "balanced"
	}

	compress(content: string, maxTokens: number): string {
		if (!this.needsCompression(content, maxTokens)) {
			return content
		}

		let compressed = content

		// Step 1: Remove only non-essential comments
		if (!this.config.preserveComments) {
			compressed = this.removeAllComments(compressed)
		} else if (!this.config.preserveDocs) {
			compressed = this.removeDocComments(compressed)
		}

		// Step 2: Use smart summarization
		const summarizer = new SmartSummarizer(this.config, this.language)
		const summary = summarizer.summarizeFile(content)

		const lines: string[] = []

		// Preserve imports
		if (summary.preservedImports) {
			lines.push(summary.preservedImports)
			lines.push("")
		}

		// Preserve class definitions
		for (const cls of summary.summarizedClasses) {
			lines.push(cls.classDefinition)
			lines.push("")
		}

		// Preserve function definitions
		for (const func of summary.summarizedFunctions) {
			lines.push(func.summary)
			lines.push("")
		}

		// Preserve exports
		if (summary.preservedExports) {
			lines.push(summary.preservedExports)
		}

		compressed = lines.join("\n")

		// Step 3: Cleanup
		compressed = this.removeBlankLines(compressed)

		return compressed
	}
}

/**
 * Preservative compression strategy
 * Preserves as much information as possible while still compressing
 */
class PreservativeCompressionStrategy extends BaseCompressionStrategy {
	getStrategyType(): CompressionStrategy {
		return "preservative"
	}

	compress(content: string, maxTokens: number): string {
		if (!this.needsCompression(content, maxTokens)) {
			return content
		}

		let compressed = content

		// Step 1: Preserve all comments (only remove excess blank lines)
		compressed = this.removeBlankLines(compressed)

		// Step 2: Collapse consecutive duplicate code patterns
		compressed = this.removeDuplicatePatterns(compressed)

		// Step 3: Summarize only very long functions
		const summarizer = new SmartSummarizer(this.config, this.language)
		const summary = summarizer.summarizeFile(content)

		// Only apply summarization if still over budget
		const estimatedTokens = this.estimateTokens(
			[
				summary.preservedImports,
				summary.preservedExports,
				...summary.summarizedClasses.map((c) => c.classDefinition),
				...summary.summarizedFunctions.map((f) => f.summary),
			].join("\n"),
		)

		if (estimatedTokens > maxTokens) {
			const lines: string[] = []

			if (summary.preservedImports) {
				lines.push(summary.preservedImports)
				lines.push("")
			}

			for (const cls of summary.summarizedClasses) {
				lines.push(cls.classDefinition)
				lines.push("")
			}

			for (const func of summary.summarizedFunctions) {
				lines.push(func.summary)
				lines.push("")
			}

			if (summary.preservedExports) {
				lines.push(summary.preservedExports)
			}

			compressed = lines.join("\n")
		}

		// Step 4: Final cleanup
		compressed = this.removeBlankLines(compressed)

		return compressed
	}

	/**
	 * Remove duplicate code patterns
	 */
	private removeDuplicatePatterns(content: string): string {
		const lines = content.split("\n")
		const seenLines = new Set<string>()
		const result: string[] = []

		for (const line of lines) {
			const trimmed = line.trim()

			// Skip duplicate empty lines
			if (trimmed === "") {
				if (result.length > 0 && result[result.length - 1].trim() !== "") {
					result.push(line)
				}
				continue
			}

			// Skip duplicate consecutive lines
			if (seenLines.has(trimmed) && result.length > 0) {
				continue
			}

			seenLines.add(trimmed)
			result.push(line)
		}

		return result.join("\n")
	}
}

/**
 * Compression strategy factory
 */
export class CompressionStrategyFactory {
	private config: CompressionConfig

	/**
	 * Create a new compression strategy factory
	 * @param config - Compression configuration
	 */
	constructor(config: CompressionConfig) {
		this.config = config
	}

	/**
	 * Create a compression strategy
	 * @param language - Programming language
	 * @returns Compression strategy instance
	 */
	createStrategy(language: string): BaseCompressionStrategy {
		switch (this.config.strategy) {
			case "aggressive":
				return new AggressiveCompressionStrategy(this.config, language)
			case "balanced":
				return new BalancedCompressionStrategy(this.config, language)
			case "preservative":
				return new PreservativeCompressionStrategy(this.config, language)
			default:
				return new BalancedCompressionStrategy(this.config, language)
		}
	}

	/**
	 * Get available strategies
	 */
	getAvailableStrategies(): CompressionStrategy[] {
		return ["aggressive", "balanced", "preservative"]
	}

	/**
	 * Get default configuration
	 */
	static getDefaultConfig(): CompressionConfig {
		return {
			enabled: true,
			strategy: "balanced",
			preserveComments: true,
			preserveDocs: true,
			minRetentionRatio: 0.3,
		}
	}
}

/**
 * Create a compression strategy by type
 * @param strategy - Strategy type
 * @param config - Compression configuration
 * @param language - Programming language
 * @returns Compression strategy instance
 */
export function createCompressionStrategy(
	strategy: CompressionStrategy,
	config: CompressionConfig,
	language: string,
): BaseCompressionStrategy {
	const factory = new CompressionStrategyFactory(config)
	return factory.createStrategy(language)
}

/**
 * Detect language from file content
 * @param content - File content
 * @param filePath - Optional file path
 * @returns Detected language
 */
function detectLanguage(content: string, filePath?: string): string {
	if (filePath) {
		const ext = filePath.split(".").pop()?.toLowerCase()
		switch (ext) {
			case "py":
				return "python"
			case "java":
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
				return "cpp"
			case "ts":
			case "tsx":
				return "typescript"
			case "js":
			case "jsx":
				return "javascript"
		}
	}

	// Content-based detection
	if (content.includes("def ") && content.includes(":")) {
		return "python"
	}
	if (content.includes("public class") || content.includes("import java.")) {
		return "java"
	}
	if (content.includes("fn ") && content.includes("{")) {
		return "rust"
	}

	return "typescript"
}

/**
 * Compress content with specified strategy
 * @param content - Content to compress
 * @param maxTokens - Maximum tokens allowed
 * @param config - Compression configuration
 * @param filePath - Optional file path for language detection
 * @returns Compressed context result
 */
export function compressWithStrategy(
	content: string,
	maxTokens: number,
	config: CompressionConfig,
	filePath?: string,
): CompressedContext {
	const language = detectLanguage(content, filePath)
	const strategy = createCompressionStrategy(config.strategy, config, language)

	const startTime = Date.now()
	const compressed = strategy.compress(content, maxTokens)
	const processingTime = Date.now() - startTime

	const originalTokens = Math.ceil(content.length / 4)
	const compressedTokens = Math.ceil(compressed.length / 4)
	const compressionRatio = originalTokens > 0 ? (originalTokens - compressedTokens) / originalTokens : 0

	const metadata: CompressionMetadata = {
		strategy: config.strategy,
		filesProcessed: 1,
		linesRemoved: content.split("\n").length - compressed.split("\n").length,
		essentialInfoPreserved: [],
		warnings: [],
	}

	return {
		content: compressed,
		originalTokens,
		compressedTokens,
		compressionRatio: Math.max(0, compressionRatio),
		preservedSections: [],
		metadata,
	}
}
