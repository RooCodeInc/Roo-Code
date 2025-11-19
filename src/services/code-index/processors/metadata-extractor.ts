/**
 * Metadata extraction utilities for tree-sitter AST nodes
 * Phase 2: Enhanced Metadata
 *
 * Extracts rich metadata from tree-sitter nodes including:
 * - Function signatures, parameters, return types
 * - Class inheritance, interface implementations
 * - Imports/exports
 * - JSDoc/docstrings
 * - Visibility modifiers, decorators
 */

import { Node, SyntaxNode } from "web-tree-sitter"
import {
	SymbolMetadata,
	ParameterInfo,
	ImportInfo,
	ExportInfo,
	SymbolType,
	Visibility,
} from "../types/metadata"

/**
 * Extracts enhanced metadata from a tree-sitter node
 * Currently supports TypeScript/JavaScript
 */
export function extractSymbolMetadata(node: SyntaxNode, fileContent: string): SymbolMetadata | null {
	const nodeType = node.type

	// Map tree-sitter node types to symbol types
	const symbolType = mapNodeTypeToSymbolType(nodeType)
	if (!symbolType) {
		return null
	}

	// Extract symbol name
	const name = extractSymbolName(node)
	if (!name) {
		return null
	}

	// Extract visibility (default to public for TypeScript/JavaScript)
	const visibility = extractVisibility(node)

	// Check if exported
	const isExported = isNodeExported(node)

	// Extract additional metadata based on symbol type
	const metadata: SymbolMetadata = {
		name,
		type: symbolType,
		visibility,
		isExported,
	}

	// Extract function/method specific metadata
	if (symbolType === "function" || symbolType === "method") {
		metadata.isAsync = isAsyncFunction(node)
		metadata.parameters = extractParameters(node)
		metadata.returnType = extractReturnType(node)
		metadata.decorators = extractDecorators(node)
	}

	// Extract class specific metadata
	if (symbolType === "class") {
		metadata.extends = extractSuperClass(node)
		metadata.implements = extractImplementedInterfaces(node)
		metadata.decorators = extractDecorators(node)
		metadata.isAbstract = isAbstractClass(node)
	}

	// Extract method specific metadata
	if (symbolType === "method") {
		metadata.isStatic = isStaticMethod(node)
		metadata.isAbstract = isAbstractMethod(node)
	}

	// Extract property specific metadata
	if (symbolType === "property") {
		metadata.isStatic = isStaticProperty(node)
	}

	// Extract documentation
	metadata.documentation = extractDocumentation(node, fileContent)

	return metadata
}

/**
 * Maps tree-sitter node type to SymbolType
 */
function mapNodeTypeToSymbolType(nodeType: string): SymbolType | null {
	const typeMap: Record<string, SymbolType> = {
		class_declaration: "class",
		function_declaration: "function",
		method_definition: "method",
		variable_declaration: "variable",
		lexical_declaration: "variable", // const/let
		interface_declaration: "interface",
		type_alias_declaration: "type",
		enum_declaration: "enum",
		property_definition: "property",
		public_field_definition: "property",
		// Arrow functions and function expressions
		arrow_function: "function",
		function_expression: "function",
	}

	return typeMap[nodeType] || null
}

/**
 * Extracts symbol name from node
 */
function extractSymbolName(node: SyntaxNode): string | null {
	// Try to get name from field
	const nameNode = node.childForFieldName("name")
	if (nameNode) {
		return nameNode.text
	}

	// Try to find identifier child
	const identifierChild = node.children.find((c) => c.type === "identifier")
	if (identifierChild) {
		return identifierChild.text
	}

	// For variable declarations, look deeper
	if (node.type === "variable_declaration" || node.type === "lexical_declaration") {
		const declarator = node.children.find((c) => c.type === "variable_declarator")
		if (declarator) {
			const nameNode = declarator.childForFieldName("name")
			if (nameNode) {
				return nameNode.text
			}
		}
	}

	return null
}

/**
 * Extracts visibility modifier
 * For TypeScript/JavaScript, defaults to public unless explicitly private/protected
 */
function extractVisibility(node: SyntaxNode): Visibility {
	// Check for accessibility modifiers in TypeScript
	const modifiers = node.children.filter((c) => c.type === "accessibility_modifier")

	for (const modifier of modifiers) {
		const text = modifier.text
		if (text === "private") return "private"
		if (text === "protected") return "protected"
		if (text === "public") return "public"
	}

	// Check if name starts with _ (convention for private)
	const name = extractSymbolName(node)
	if (name && name.startsWith("_")) {
		return "private"
	}

	return "public"
}

/**
 * Checks if node is exported
 */
function isNodeExported(node: SyntaxNode): boolean {
	// Check if parent is export_statement
	let current: SyntaxNode | null = node
	while (current) {
		if (current.type === "export_statement" || current.type === "export_declaration") {
			return true
		}
		// Check for export keyword in siblings
		if (current.parent) {
			const exportKeyword = current.parent.children.find((c) => c.type === "export")
			if (exportKeyword) {
				return true
			}
		}
		current = current.parent
	}
	return false
}

/**
 * Checks if function/method is async
 */
function isAsyncFunction(node: SyntaxNode): boolean {
	// Look for async keyword
	const asyncKeyword = node.children.find((c) => c.type === "async" || c.text === "async")
	return !!asyncKeyword
}

/**
 * Checks if method is static
 */
function isStaticMethod(node: SyntaxNode): boolean {
	const staticKeyword = node.children.find((c) => c.type === "static" || c.text === "static")
	return !!staticKeyword
}

/**
 * Checks if property is static
 */
function isStaticProperty(node: SyntaxNode): boolean {
	const staticKeyword = node.children.find((c) => c.type === "static" || c.text === "static")
	return !!staticKeyword
}

/**
 * Checks if class is abstract
 */
function isAbstractClass(node: SyntaxNode): boolean {
	const abstractKeyword = node.children.find((c) => c.type === "abstract" || c.text === "abstract")
	return !!abstractKeyword
}

/**
 * Checks if method is abstract
 */
function isAbstractMethod(node: SyntaxNode): boolean {
	const abstractKeyword = node.children.find((c) => c.type === "abstract" || c.text === "abstract")
	return !!abstractKeyword
}

/**
 * Extracts function/method parameters
 */
function extractParameters(node: SyntaxNode): ParameterInfo[] {
	const parameters: ParameterInfo[] = []

	// Find formal_parameters or parameters node
	const paramsNode = node.childForFieldName("parameters") || node.children.find((c) => c.type === "formal_parameters")

	if (!paramsNode) {
		return parameters
	}

	// Extract each parameter
	for (const child of paramsNode.children) {
		if (child.type === "required_parameter" || child.type === "optional_parameter") {
			const param = extractParameter(child)
			if (param) {
				parameters.push(param)
			}
		} else if (child.type === "rest_parameter") {
			const param = extractParameter(child)
			if (param) {
				param.isRest = true
				parameters.push(param)
			}
		}
	}

	return parameters
}

/**
 * Extracts a single parameter
 */
function extractParameter(paramNode: SyntaxNode): ParameterInfo | null {
	const nameNode = paramNode.childForFieldName("pattern") || paramNode.childForFieldName("name")
	if (!nameNode) {
		return null
	}

	const name = nameNode.text
	const optional = paramNode.type === "optional_parameter" || paramNode.text.includes("?")

	// Extract type annotation
	let type: string | undefined
	const typeNode = paramNode.childForFieldName("type")
	if (typeNode) {
		type = typeNode.text
	}

	// Extract default value
	let defaultValue: string | undefined
	const valueNode = paramNode.childForFieldName("value")
	if (valueNode) {
		defaultValue = valueNode.text
	}

	return {
		name,
		type,
		optional,
		defaultValue,
	}
}

/**
 * Extracts return type annotation
 */
function extractReturnType(node: SyntaxNode): string | undefined {
	const returnTypeNode = node.childForFieldName("return_type")
	if (returnTypeNode) {
		// Remove leading colon if present
		const text = returnTypeNode.text
		return text.startsWith(":") ? text.slice(1).trim() : text
	}
	return undefined
}

/**
 * Extracts decorators/annotations
 */
function extractDecorators(node: SyntaxNode): string[] | undefined {
	const decorators: string[] = []

	// Look for decorator nodes
	for (const child of node.children) {
		if (child.type === "decorator") {
			decorators.push(child.text)
		}
	}

	return decorators.length > 0 ? decorators : undefined
}

/**
 * Extracts super class name
 */
function extractSuperClass(node: SyntaxNode): string | undefined {
	const heritageNode = node.children.find((c) => c.type === "class_heritage")
	if (!heritageNode) {
		return undefined
	}

	const extendsClause = heritageNode.children.find((c) => c.type === "extends_clause")
	if (!extendsClause) {
		return undefined
	}

	// Get the type identifier
	const typeNode = extendsClause.children.find((c) => c.type === "identifier" || c.type === "type_identifier")
	return typeNode?.text
}


/**
 * Extracts implemented interfaces
 */
function extractImplementedInterfaces(node: SyntaxNode): string[] | undefined {
	const interfaces: string[] = []

	const heritageNode = node.children.find((c) => c.type === "class_heritage")
	if (!heritageNode) {
		return undefined
	}

	const implementsClause = heritageNode.children.find((c) => c.type === "implements_clause")
	if (!implementsClause) {
		return undefined
	}

	// Get all type identifiers
	for (const child of implementsClause.children) {
		if (child.type === "identifier" || child.type === "type_identifier") {
			interfaces.push(child.text)
		}
	}

	return interfaces.length > 0 ? interfaces : undefined
}

/**
 * Extracts JSDoc/documentation comments
 */
function extractDocumentation(node: SyntaxNode, fileContent: string): string | undefined {
	// Look for comment node before this node
	const startByte = node.startIndex
	const startLine = node.startPosition.row

	// Search backwards for JSDoc comment
	if (startLine > 0) {
		// Get the lines before the node
		const lines = fileContent.split("\n")
		let commentLines: string[] = []
		let foundComment = false

		// Look backwards from the line before the node
		for (let i = startLine - 1; i >= 0; i--) {
			const line = lines[i].trim()

			// Stop if we hit a non-comment line
			if (line && !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*") && !line.endsWith("*/")) {
				break
			}

			// Collect comment lines
			if (line.startsWith("/**") || line.startsWith("/*")) {
				foundComment = true
				commentLines.unshift(line)
				break
			} else if (line.startsWith("*") || line.startsWith("//")) {
				commentLines.unshift(line)
			} else if (line.endsWith("*/")) {
				commentLines.unshift(line)
			}
		}

		if (foundComment && commentLines.length > 0) {
			// Clean up JSDoc comment
			const doc = commentLines
				.join("\n")
				.replace(/^\/\*\*\s*/, "") // Remove /**
				.replace(/\s*\*\/\s*$/, "") // Remove */
				.replace(/^\s*\*\s?/gm, "") // Remove leading * from each line
				.trim()

			return doc || undefined
		}
	}

	return undefined
}

/**
 * Extracts import information from import statements
 */
export function extractImportInfo(node: SyntaxNode): ImportInfo | null {
	if (node.type !== "import_statement") {
		return null
	}

	// Extract source
	const sourceNode = node.childForFieldName("source")
	if (!sourceNode) {
		return null
	}

	const source = sourceNode.text.replace(/['"]/g, "") // Remove quotes

	// Check if default import
	const defaultSpecifier = node.children.find((c) => c.type === "import_clause")
	const isDefault = !!defaultSpecifier

	// Extract named imports
	const symbols: string[] = []
	const namedImports = node.children.find((c) => c.type === "named_imports")
	if (namedImports) {
		for (const child of namedImports.children) {
			if (child.type === "import_specifier") {
				const nameNode = child.childForFieldName("name")
				if (nameNode) {
					symbols.push(nameNode.text)
				}
			}
		}
	}

	// Check for namespace import (import * as foo)
	let alias: string | undefined
	const namespaceImport = node.children.find((c) => c.type === "namespace_import")
	if (namespaceImport) {
		const aliasNode = namespaceImport.children.find((c) => c.type === "identifier")
		if (aliasNode) {
			alias = aliasNode.text
		}
	}

	return {
		source,
		symbols,
		isDefault,
		isDynamic: false, // Static imports
		alias,
	}
}

/**
 * Extracts export information from export statements
 */
export function extractExportInfo(node: SyntaxNode): ExportInfo | null {
	if (node.type !== "export_statement" && node.type !== "export_declaration") {
		return null
	}

	// Check for default export
	const isDefault = node.children.some((c) => c.type === "default" || c.text === "default")

	// Extract symbol name
	let symbol: string | null = null
	let source: string | undefined

	// For export { foo } or export { foo as bar }
	const exportClause = node.children.find((c) => c.type === "export_clause")
	if (exportClause) {
		const specifier = exportClause.children.find((c) => c.type === "export_specifier")
		if (specifier) {
			const nameNode = specifier.childForFieldName("name")
			if (nameNode) {
				symbol = nameNode.text
			}
		}
	}

	// For export class/function/const
	const declaration = node.children.find(
		(c) =>
			c.type === "class_declaration" ||
			c.type === "function_declaration" ||
			c.type === "lexical_declaration" ||
			c.type === "variable_declaration",
	)
	if (declaration) {
		symbol = extractSymbolName(declaration)
	}

	// Check for re-export (export { foo } from './bar')
	const sourceNode = node.childForFieldName("source")
	if (sourceNode) {
		source = sourceNode.text.replace(/['"]/g, "")
	}

	if (!symbol) {
		return null
	}

	return {
		symbol,
		type: isDefault ? "default" : source ? "re-export" : "named",
		source,
	}
}


