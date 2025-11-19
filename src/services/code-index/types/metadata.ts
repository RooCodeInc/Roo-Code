/**
 * Enhanced metadata types for code indexing
 * Phase 2: Enhanced Metadata
 *
 * These types provide rich contextual information for semantic search,
 * enabling better code understanding and more relevant search results.
 *
 * @see KNOWLEDGEAUDIT/METADATA_SCHEMA.md for detailed documentation
 */

/**
 * Symbol type classification
 */
export type SymbolType =
	| "class"
	| "function"
	| "method"
	| "variable"
	| "constant"
	| "interface"
	| "type"
	| "enum"
	| "property"

/**
 * Access modifier / visibility
 */
export type Visibility = "public" | "private" | "protected" | "internal"

/**
 * Comprehensive symbol metadata
 */
export interface SymbolMetadata {
	/** Symbol name (e.g., "UserService", "authenticate") */
	name: string

	/** Symbol type classification */
	type: SymbolType

	/** Access modifier / visibility */
	visibility: Visibility

	/** Whether symbol is exported from module */
	isExported: boolean

	/** For functions/methods: is async? */
	isAsync?: boolean

	/** For methods/properties: is static? */
	isStatic?: boolean

	/** For classes/methods: is abstract? */
	isAbstract?: boolean

	/** For functions/methods: parameter list */
	parameters?: ParameterInfo[]

	/** For functions/methods: return type */
	returnType?: string

	/** JSDoc/docstring/comments */
	documentation?: string

	/** Decorators/annotations (e.g., @Component, @Injectable) */
	decorators?: string[]

	/** For classes: parent class name */
	extends?: string

	/** For classes: implemented interfaces */
	implements?: string[]
}

/**
 * Function/method parameter information
 */
export interface ParameterInfo {
	/** Parameter name */
	name: string

	/** Parameter type (if available) */
	type?: string

	/** Is parameter optional? */
	optional: boolean

	/** Default value (if any) */
	defaultValue?: string

	/** Is rest parameter (...args)? */
	isRest?: boolean
}

/**
 * Import statement information
 */
export interface ImportInfo {
	/** Module path or package name */
	source: string

	/** Imported symbols (empty for default imports) */
	symbols: string[]

	/** Is default import? */
	isDefault: boolean

	/** Is dynamic import (import())? */
	isDynamic: boolean

	/** Import alias (e.g., "import * as fs") */
	alias?: string
}

/**
 * Export statement information
 */
export interface ExportInfo {
	/** Exported symbol name */
	symbol: string

	/** Export type */
	type: "named" | "default" | "re-export"

	/** For re-exports: original source */
	source?: string

	/** Export alias (e.g., "export { Foo as Bar }") */
	alias?: string
}

/**
 * File-level metadata
 */
export interface FileMetadata {
	/** Programming language (TypeScript, Python, etc.) */
	language: string

	/** Framework (React, Vue, Express, Django, etc.) */
	framework?: string

	/** File category (component, service, controller, test, etc.) */
	category?: string

	/** External dependencies used in file */
	dependencies: string[]

	/** All exports from file */
	exports: ExportInfo[]

	/** All imports in file */


/**
 * Enhanced code segment with rich metadata
 *
 * Combines existing code block fields with enhanced metadata.
 * This is the primary structure stored in the vector database.
 *
 * All Phase 2 fields are optional to maintain backward compatibility.
 */
export interface EnhancedCodeSegment {
	// ===== Existing Fields (Backward Compatible) =====

	/** Unique hash for this code segment */
	segmentHash: string

	/** Absolute file path */
	filePath: string

	/** Code content */
	content: string

	/** Starting line number (1-based) */
	startLine: number

	/** Ending line number (1-based) */
	endLine: number

	/** Hash of entire file content */
	fileHash: string

	// ===== Basic Metadata (Phase 1) =====

	/** Symbol name (if applicable) */
	identifier: string | null

	/** Tree-sitter node type */
	type: string | null

	/** Programming language */
	language: string

	// ===== Enhanced Symbol Metadata (Phase 2) =====

	/** Full symbol information */
	symbolMetadata?: SymbolMetadata

	// ===== Import/Export Information (Phase 2) =====

	/** Imports used in this segment */
	imports?: ImportInfo[]

	/** Exports from this segment */
	exports?: ExportInfo[]

	// ===== Documentation (Phase 2) =====

	/** Extracted JSDoc/docstring/comments */
	documentation?: string

	// ===== File-Level Context (Phase 2) =====

	/** File-level metadata for context */
	fileMetadata?: FileMetadata

	// ===== Relationships (Phase 4 - Neo4j) =====
	// These will be populated in Phase 4 when Neo4j integration is added

	/** Function/method calls made in this segment */
	calls?: string[]

	/** Functions/methods that call this segment */
	calledBy?: string[]

	/** Symbols referenced in this segment */
	references?: string[]

	/** Segments that reference this symbol */
	referencedBy?: string[]
}

/**
 * Validation helper for SymbolMetadata
 */
export function validateSymbolMetadata(metadata: SymbolMetadata): boolean {
	// Name is required
	if (!metadata.name || metadata.name.trim() === "") {
		return false
	}

	// Type must be valid
	const validTypes: SymbolType[] = [
		"class",
		"function",
		"method",
		"variable",
		"constant",
		"interface",
		"type",
		"enum",
		"property",
	]
	if (!validTypes.includes(metadata.type)) {
		return false
	}

	// Visibility must be valid
	const validVisibility: Visibility[] = ["public", "private", "protected", "internal"]
	if (!validVisibility.includes(metadata.visibility)) {
		return false
	}

	// Parameters must be valid (if present)
	if (metadata.parameters) {
		for (const param of metadata.parameters) {
			if (!param.name || param.name.trim() === "") {
				return false
			}
		}
	}

	return true
}

/**
 * Helper to build embedding context from enhanced metadata
 *
 * Enriches code content with metadata for better semantic understanding.
 */
export function buildEmbeddingContext(segment: EnhancedCodeSegment): string {
	const parts: string[] = []

	// Add symbol information
	if (segment.symbolMetadata) {
		parts.push(`Symbol: ${segment.symbolMetadata.name} (${segment.symbolMetadata.type})`)

		if (segment.symbolMetadata.documentation) {
			parts.push(`Documentation: ${segment.symbolMetadata.documentation}`)
		}

		if (segment.symbolMetadata.parameters && segment.symbolMetadata.parameters.length > 0) {
			const params = segment.symbolMetadata.parameters
				.map((p) => `${p.name} (${p.type || "any"})`)
				.join(", ")
			parts.push(`Parameters: ${params}`)
		}

		if (segment.symbolMetadata.returnType) {
			parts.push(`Returns: ${segment.symbolMetadata.returnType}`)
		}
	}

	// Add import context
	if (segment.imports && segment.imports.length > 0) {
		const importNames = segment.imports.map((i) => i.source).join(", ")
		parts.push(`Imports: ${importNames}`)
	}

	// Add code content
	parts.push("")
	parts.push(segment.content)

	return parts.join("\n")
}

