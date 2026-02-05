/**
 * Enhanced Symbol Interface for Tree-sitter Parsing
 *
 * This interface extends the basic symbol information with additional metadata
 * such as generics, decorators, inheritance, and visibility modifiers.
 */

/**
 * Symbol type definitions for enhanced parsing
 */
export type SymbolType =
	| "function"
	| "class"
	| "interface"
	| "enum"
	| "typeAlias"
	| "genericType"
	| "decorator"
	| "annotation"
	| "import"
	| "method"
	| "property"
	| "record"
	| "namespace"
	| "module"

/**
 * Visibility modifier types
 */
export type VisibilityModifier = "public" | "private" | "protected" | "internal" | "readonly"

/**
 * Enhanced symbol interface with comprehensive metadata
 */
export interface EnhancedSymbol {
	/** The name of the symbol */
	name: string

	/** The type of symbol */
	type: SymbolType

	/** Location in the source file */
	location: {
		start: number // Line number (0-indexed)
		end: number // Line number (0-indexed)
		startColumn?: number
		endColumn?: number
	}

	/** Function/method signature (for callable symbols) */
	signature?: string

	/** Generic type parameters */
	generics?: string[]

	/** Decorators/Annotations applied to this symbol */
	decorators?: string[]

	/** Classes/interfaces this symbol extends */
	extends?: string[]

	/** Interfaces this symbol implements */
	implements?: string[]

	/** Whether the symbol is exported */
	exported: boolean

	/** Visibility modifier */
	visibility: VisibilityModifier

	/** Parent class for nested symbols */
	parentClass?: string

	/** Return type for functions/methods */
	returnType?: string

	/** Parameter types for functions/methods */
	parameterTypes?: string[]

	/** File path where this symbol is defined */
	filePath?: string

	/** Raw source code snippet */
	source?: string
}

/**
 * Enhanced query result container
 */
export interface EnhancedParseResult {
	/** Array of extracted symbols */
	symbols: EnhancedSymbol[]

	/** Original source file path */
	filePath: string

	/** Source file content */
	content: string

	/** Number of lines in the source file */
	lineCount: number

	/** Parse errors if any */
	errors?: string[]
}

/**
 * Query capture mapping for enhanced parsing
 */
export interface EnhancedCapture {
	/** Capture name from tree-sitter query */
	captureName: string

	/** Captured text value */
	value: string

	/** Node start position */
	startPosition: { row: number; column: number }

	/** Node end position */
	endPosition: { row: number; column: number }
}

/**
 * Type parameter constraint information
 */
export interface TypeParameterConstraint {
	/** Parameter name */
	name: string

	/** Constraint type (e.g., 'extends Comparable') */
	constraint?: string

	/** Default type if specified */
	default?: string
}

/**
 * Decorator/Annotation parameter information
 */
export interface DecoratorInfo {
	/** Decorator name */
	name: string

	/** Full decorator call expression */
	fullExpression: string

	/** Arguments passed to decorator */
	arguments?: string[]

	/** Target element being decorated */
	target?: string
}

/**
 * Import statement information
 */
export interface ImportInfo {
	/** Module/path being imported */
	modulePath: string

	/** Imported symbols (if specific imports) */
	importedSymbols?: string[]

	/** Whether this is a default import */
	isDefault: boolean

	/** Whether this is a namespace import (import *) */
	isNamespace: boolean

	/** Alias if specified */
	alias?: string
}
