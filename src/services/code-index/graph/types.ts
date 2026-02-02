/**
 * Knowledge Graph Type Definitions
 * Version-aware types for forward compatibility
 */

export const GRAPH_VERSION = 1

/**
 * Core node representing a file in the knowledge graph
 */
export interface GraphNode {
	/** Unique identifier (file path) */
	id: string
	/** Content hash for change detection */
	contentHash: string
	/** Timestamp of last update */
	lastUpdated: number
	/** Direct dependencies (imports) */
	imports: DependencyEdge[]
	/** Symbols exported by this file */
	exports: ExportSymbol[]
	/** Metadata for observability */
	metadata: NodeMetadata
}

/**
 * Edge representing a dependency relationship with full context
 */
export interface DependencyEdge {
	/** Target file path */
	target: string
	/** Type of relationship */
	type: DependencyType
	/** Line number where import occurs */
	lineNumber: number
	/** Is this a transitive import */
	isTransitive: boolean
	/** Confidence score (1.0 = certain) */
	confidence: number
}

/**
 * Exported symbol with full context
 */
export interface ExportSymbol {
	/** Symbol name */
	name: string
	/** Symbol type (function, class, interface, etc.) */
	type: SymbolType
	/** Declaration line */
	lineNumber: number
	/** Accessibility (public, private, protected) */
	accessibility: Accessibility
	/** Deprecation status */
	isDeprecated: boolean
}

/**
 * Node metadata for observability and debugging
 */
export interface NodeMetadata {
	/** Size in bytes */
	fileSize: number
	/** Number of lines */
	lineCount: number
	/** Parse duration in ms */
	parseDuration: number
	/** Number of parsing attempts */
	parseAttempts: number
	/** Last parse error if any */
	lastError?: string
}

/**
 * Complete graph snapshot for persistence
 */
export interface GraphSnapshot {
	/** Graph format version */
	version: number
	/** Schema version for compatibility */
	schemaVersion: string
	/** Build timestamp */
	builtAt: number
	/** Total nodes */
	nodeCount: number
	/** Total edges */
	edgeCount: number
	/** Workspace root */
	workspaceRoot: string
	/** Nodes indexed by file path */
	nodes: Record<string, GraphNode>
	/** Reverse index: dependents -> sources */
	dependentsIndex: Record<string, string[]>
	/** Build metadata */
	buildInfo: BuildMetadata
}

/**
 * Build metadata for debugging and optimization
 */
export interface BuildMetadata {
	/** Total build duration */
	duration: number
	/** Files processed successfully */
	successCount: number
	/** Files that failed */
	failureCount: number
	/** Memory usage at peak */
	peakMemoryUsage: number
	/** Changes since last build */
	changes: GraphChange[]
}

/**
 * Represents a change in the graph
 */
export interface GraphChange {
	/** Type of change */
	type: "added" | "modified" | "removed"
	/** Affected file path */
	filePath: string
	/** Previous content hash (if modified/removed) */
	previousHash?: string
	/** New content hash (if added/modified) */
	newHash?: string
	/** Timestamp of change */
	timestamp: number
}

/**
 * Result of a parse operation
 */
export interface ParseResult {
	/** File that was parsed */
	filePath: string
	/** Extracted imports */
	imports: DependencyEdge[]
	/** Extracted exports */
	exports: ExportSymbol[]
	/** Parse duration in ms */
	parseDuration: number
	/** Whether parsing succeeded */
	success: boolean
	/** Error message if failed */
	error?: string
}

export enum DependencyType {
	IMPORT = "import",
	REQUIRE = "require",
	EXPORT = "export",
	EXTENDS = "extends",
	IMPLEMENTS = "implements",
	TYPE_REFERENCE = "type_reference",
}

export enum SymbolType {
	FUNCTION = "function",
	CLASS = "class",
	INTERFACE = "interface",
	TYPE_ALIAS = "type_alias",
	ENUM = "enum",
	CONSTANT = "constant",
	MODULE = "module",
	NAMESPACE = "namespace",
}

export enum Accessibility {
	PUBLIC = "public",
	PRIVATE = "private",
	PROTECTED = "protected",
	INTERNAL = "internal",
}

/**
 * Result of save operation
 */
export interface SaveResult {
	success: boolean
	duration: number
	nodeCount: number
	edgeCount: number
	error?: string
}

/**
 * Result of load operation
 */
export interface LoadResult {
	success: boolean
	loadedFromDisk: boolean
	nodeCount: number
	duration: number
	previousVersion?: number
	error?: string
}

/**
 * Graph statistics for monitoring
 */
export interface GraphStats {
	nodeCount: number
	edgeCount: number
	averageDegree: number
	maxDegree: number
	connectedComponents: number
	cyclicDependencies: number
	memoryUsage: number
	lastUpdated: number
}
