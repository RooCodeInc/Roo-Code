/**
 * Context Compression Interfaces
 *
 * Defines the core interfaces for context compression functionality.
 * Provides smart compression of code content while preserving essential information.
 */

/**
 * Compression strategy types
 */
export type CompressionStrategy = "aggressive" | "balanced" | "preservative"

/**
 * Configuration for context compression
 */
export interface CompressionConfig {
	/** Enable/disable compression */
	enabled: boolean
	/** Compression strategy to use */
	strategy: CompressionStrategy
	/** Preserve comments in compressed output */
	preserveComments: boolean
	/** Preserve documentation comments */
	preserveDocs: boolean
	/** Minimum preservation ratio (0-1) */
	minRetentionRatio: number
	/** Optional model for summarization */
	summaryModel?: string
	/** Maximum tokens for compressed content */
	maxTokens?: number
	/** Language-specific settings */
	languageSettings?: Record<string, LanguageCompressionSettings>
}

/**
 * Language-specific compression settings
 */
export interface LanguageCompressionSettings {
	/** Preserve imports */
	preserveImports: boolean
	/** Preserve exports */
	preserveExports: boolean
	/** Preserve function signatures */
	preserveSignatures: boolean
	/** Preserve class/interface definitions */
	preserveDefinitions: boolean
	/** Comment patterns to preserve */
	preserveCommentPatterns?: string[]
}

/**
 * Function information extracted from code
 */
export interface FunctionInfo {
	/** Function name */
	name: string
	/** Function signature */
	signature: string
	/** Start line number */
	startLine: number
	/** End line number */
	endLine: number
	/** Function body */
	body: string
	/** Documentation comment */
	docComment?: string
	/** Is async function */
	isAsync: boolean
	/** Is generator function */
	isGenerator: boolean
	/** Parameters */
	parameters: ParameterInfo[]
}

/**
 * Parameter information
 */
export interface ParameterInfo {
	/** Parameter name */
	name: string
	/** Parameter type */
	type: string
	/** Is optional */
	isOptional: boolean
	/** Default value */
	defaultValue?: string
}

/**
 * Class information extracted from code
 */
export interface ClassInfo {
	/** Class name */
	name: string
	/** Class signature (extends/implements) */
	signature: string
	/** Start line number */
	startLine: number
	/** End line number */
	endLine: number
	/** Class body */
	body: string
	/** Documentation comment */
	docComment?: string
	/** Extends clause */
	extendsClause?: string
	/** Implements clauses */
	implementsClauses?: string[]
	/** Methods */
	methods: FunctionInfo[]
	/** Properties */
	properties: PropertyInfo[]
}

/**
 * Property information
 */
export interface PropertyInfo {
	/** Property name */
	name: string
	/** Property type */
	type: string
	/** Is readonly */
	isReadonly: boolean
	/** Is static */
	isStatic: boolean
	/** Access modifier */
	accessModifier?: "public" | "private" | "protected"
}

/**
 * Import information extracted from code
 */
export interface ImportInfo {
	/** Import path */
	path: string
	/** Import type (default, named, namespace) */
	importType: "default" | "named" | "namespace" | "sideEffect"
	/** Imported names */
	importedNames: string[]
	/** Aliases */
	aliases: Record<string, string>
}

/**
 * Export information extracted from code
 */
export interface ExportInfo {
	/** Export type (named, default, re-export) */
	exportType: "named" | "default" | "reexport"
	/** Exported name */
	exportedName: string
	/** Target path (for re-exports) */
	targetPath?: string
}

/**
 * Summarized function result
 */
export interface SummarizedFunction {
	/** Original function signature */
	signature: string
	/** Summarized function body */
	summary: string
	/** Number of lines compressed */
	linesCompressed: number
	/** Is essential (preserved) */
	isEssential: boolean
}

/**
 * Summarized class result
 */
export interface SummarizedClass {
	/** Class definition */
	classDefinition: string
	/** Summarized methods */
	summarizedMethods: SummarizedFunction[]
	/** Properties retained */
	retainedProperties: string[]
	/** Lines compressed */
	linesCompressed: number
}

/**
 * Summarized file result
 */
export interface SummarizedFile {
	/** File path */
	filePath: string
	/** File language */
	language: string
	/** Preserved imports */
	preservedImports: string
	/** Preserved exports */
	preservedExports: string
	/** Summarized classes */
	summarizedClasses: SummarizedClass[]
	/** Summarized functions */
	summarizedFunctions: SummarizedFunction[]
	/** Top-level code preserved */
	topLevelCode: string
	/** Total lines compressed */
	totalLinesCompressed: number
	/** Token reduction ratio */
	tokenReductionRatio: number
}

/**
 * Compressed context result
 */
export interface CompressedContext {
	/** Compressed content */
	content: string
	/** Original token count */
	originalTokens: number
	/** Compressed token count */
	compressedTokens: number
	/** Compression ratio */
	compressionRatio: number
	/** Sections preserved */
	preservedSections: string[]
	/** Compression metadata */
	metadata: CompressionMetadata
}

/**
 * Compression metadata
 */
export interface CompressionMetadata {
	/** Strategy used */
	strategy: CompressionStrategy
	/** Files processed */
	filesProcessed: number
	/** Lines removed */
	linesRemoved: number
	/** Essential info preserved */
	essentialInfoPreserved: string[]
	/** Compression warnings */
	warnings: string[]
}

/**
 * Statistics for compression operations
 */
export interface CompressionStats {
	/** Total compressions performed */
	totalCompressions: number
	/** Average compression ratio */
	averageCompressionRatio: number
	/** Total tokens saved */
	totalTokensSaved: number
	/** Average processing time (ms) */
	averageProcessingTimeMs: number
}

/**
 * Core context compressor interface
 */
export interface ContextCompressor {
	/**
	 * Compress a context string to fit within max tokens
	 * @param context - The context string to compress
	 * @param maxTokens - Maximum tokens allowed
	 * @returns Compressed context result
	 */
	compress(context: string, maxTokens: number): Promise<CompressedContext>

	/**
	 * Compress file content for context
	 * @param fileContent - File content to compress
	 * @param maxTokens - Maximum tokens allowed
	 * @param filePath - Optional file path for language detection
	 * @returns Compressed file content
	 */
	compressFile(fileContent: string, maxTokens: number, filePath?: string): Promise<string>

	/**
	 * Preserve structure of content
	 * @param content - Content to analyze
	 * @returns Array of preserved structural elements
	 */
	preserveStructure(content: string): string[]

	/**
	 * Summarize a code section
	 * @param section - Code section to summarize
	 * @returns Summarized section
	 */
	summarizeSection(section: string): string

	/**
	 * Get compression statistics
	 * @returns Compression statistics
	 */
	getCompressionStats(): CompressionStats
}
