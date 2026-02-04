/**
 * Semantic Analysis Interfaces
 * Type definitions for deep code analysis, symbol resolution, and architecture detection
 */

// ============================================================================
// Symbol Types
// ============================================================================

export type SymbolType =
	| "function"
	| "method"
	| "class"
	| "interface"
	| "variable"
	| "constant"
	| "parameter"
	| "property"
	| "type"
	| "enum"
	| "module"
	| "namespace"

export type SymbolScope = "local" | "module" | "global" | "class" | "function"

export interface Position {
	line: number
	column: number
	offset?: number
}

export interface Range {
	start: Position
	end: Position
}

export interface Reference {
	filePath: string
	position: Position
	type: "read" | "write" | "call" | "definition" | "import"
}

// ============================================================================
// Symbol Information
// ============================================================================

export interface SymbolInfo {
	name: string
	type: SymbolType
	scope: SymbolScope
	position: Position
	range?: Range
	references: Reference[]
	documentation?: string
	signature?: string
	modifiers?: string[] // public, private, static, async, etc.
	parentSymbol?: string
}

export interface ResolvedSymbol extends SymbolInfo {
	filePath: string
	definitionRange: Range
	isExported: boolean
}

// ============================================================================
// Semantic Relations
// ============================================================================

export type RelationType =
	| "calls" // A function calls another function
	| "extends" // A class extends another class
	| "implements" // A class implements an interface
	| "imports" // A module imports from another
	| "uses" // A symbol uses another symbol
	| "defines" // A module defines a symbol
	| "overrides" // A method overrides a parent method
	| "composes" // A class contains another class (composition)
	| "references" // General reference to a symbol

export interface SemanticRelation {
	source: SymbolInfo
	target: SymbolInfo
	relationType: RelationType
	strength: number // 0-1, indicates how strong the relationship is
	metadata?: Record<string, unknown>
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface FunctionAnalysis {
	name: string
	signature: string
	parameters: ParameterInfo[]
	returnType?: string
	isAsync: boolean
	isGenerator: boolean
	complexity: number // Cyclomatic complexity
	lineCount: number
	calls: string[] // Functions this function calls
	position: Position
	range: Range
	documentation?: string
}

export interface ParameterInfo {
	name: string
	type?: string
	defaultValue?: string
	isOptional: boolean
	isRest: boolean
}

export interface ClassAnalysis {
	name: string
	extends?: string
	implements: string[]
	properties: PropertyInfo[]
	methods: FunctionAnalysis[]
	isAbstract: boolean
	position: Position
	range: Range
	documentation?: string
}

export interface PropertyInfo {
	name: string
	type?: string
	visibility: "public" | "private" | "protected"
	isStatic: boolean
	isReadonly: boolean
	defaultValue?: string
}

export interface ImportAnalysis {
	modulePath: string
	isRelative: boolean
	importedSymbols: ImportedSymbol[]
	isDefault: boolean
	isNamespace: boolean
	alias?: string
}

export interface ImportedSymbol {
	name: string
	alias?: string
	isType: boolean
}

export interface ExportAnalysis {
	name: string
	type: SymbolType
	isDefault: boolean
	isReExport: boolean
	originalModule?: string
}

// ============================================================================
// Complexity Metrics
// ============================================================================

export interface ComplexityMetrics {
	cyclomaticComplexity: number
	cognitiveComplexity: number
	linesOfCode: number
	linesOfComments: number
	maintainabilityIndex: number
	halsteadMetrics?: HalsteadMetrics
}

export interface HalsteadMetrics {
	vocabulary: number
	length: number
	volume: number
	difficulty: number
	effort: number
}

// ============================================================================
// Dependency Information
// ============================================================================

export interface DependencyInfo {
	filePath: string
	type: "internal" | "external" | "builtin"
	importedSymbols: string[]
	isDevDependency?: boolean
}

// ============================================================================
// Deep Analysis Result
// ============================================================================

export interface DeepAnalysis {
	filePath: string
	language: string
	symbols: SymbolInfo[]
	functions: FunctionAnalysis[]
	classes: ClassAnalysis[]
	imports: ImportAnalysis[]
	exports: ExportAnalysis[]
	complexity: ComplexityMetrics
	dependencies: DependencyInfo[]
	relations: SemanticRelation[]
	analyzedAt: Date
}

// ============================================================================
// Architecture Detection Types
// ============================================================================

export type ArchitecturePatternType =
	| "mvc"
	| "mvvm"
	| "mvp"
	| "clean-architecture"
	| "hexagonal"
	| "microservices"
	| "monolith"
	| "serverless"
	| "event-driven"
	| "unknown"

export interface DetectedArchitecture {
	primaryPattern: ArchitecturePatternType
	confidence: number
	allPatterns: PatternScore[]
	layers: LayerDefinition[]
	customFrameworks: DetectedFramework[]
}

export interface PatternScore {
	pattern: ArchitecturePatternType
	score: number
	evidence: string[]
}

export interface LayerDefinition {
	name: string
	type: "presentation" | "business" | "data" | "infrastructure" | "domain" | "application"
	directories: string[]
	files: string[]
}

export interface DetectedFramework {
	name: string
	type: "web" | "orm" | "testing" | "build" | "erp" | "other"
	version?: string
	configFiles: string[]
	confidence: number
}

// ============================================================================
// File Context for Symbol Resolution
// ============================================================================

export interface FileContext {
	filePath: string
	language: string
	imports: ImportAnalysis[]
	localSymbols: SymbolInfo[]
	currentScope?: string
}

// ============================================================================
// Semantic Analyzer Interface
// ============================================================================

export interface ISemanticAnalyzer {
	/**
	 * Perform deep analysis on a file
	 * @param filePath - Absolute path to the file
	 * @param content - Optional file content (read from disk if not provided)
	 */
	analyzeDeep(filePath: string, content?: string): Promise<DeepAnalysis>

	/**
	 * Extract semantic relations from code content
	 * @param content - Code content to analyze
	 * @param language - Programming language
	 */
	extractSemanticRelations(content: string, language: string): Promise<SemanticRelation[]>

	/**
	 * Get supported languages
	 */
	getSupportedLanguages(): string[]
}

// ============================================================================
// Symbol Resolver Interface
// ============================================================================

export interface ISymbolResolver {
	/**
	 * Resolve a symbol to its definition
	 * @param symbol - Symbol name to resolve
	 * @param context - Current file context
	 */
	resolveSymbol(symbol: string, context: FileContext): Promise<ResolvedSymbol | null>

	/**
	 * Index symbols from a file
	 * @param filePath - Path to the file
	 * @param content - File content
	 */
	indexFile(filePath: string, content: string): Promise<void>

	/**
	 * Get all references to a symbol
	 * @param symbol - Symbol name
	 * @param filePath - File where symbol is defined
	 */
	getReferences(symbol: string, filePath: string): Promise<Reference[]>

	/**
	 * Invalidate cache for a file
	 * @param filePath - Path to invalidate
	 */
	invalidateFile(filePath: string): void
}

// ============================================================================
// Architecture Detector Interface
// ============================================================================

export interface IArchitectureDetector {
	/**
	 * Detect architectural pattern of a project
	 * @param projectPath - Root path of the project
	 */
	detectPattern(projectPath: string): Promise<DetectedArchitecture>

	/**
	 * Identify layers in the project structure
	 * @param projectPath - Root path of the project
	 */
	identifyLayers(projectPath: string): Promise<LayerDefinition[]>

	/**
	 * Detect custom frameworks used in the project
	 * @param projectPath - Root path of the project
	 */
	detectCustomFrameworks(projectPath: string): Promise<DetectedFramework[]>
}
