/**
 * Semantic Analyzer
 * Deep code analysis using Tree-sitter for extracting symbols, relations, and complexity metrics
 */

import * as fs from "fs/promises"
import * as path from "path"
import { loadEnhancedLanguageParsers, EnhancedLanguageParser } from "../../tree-sitter/languageParser"
import {
	DeepAnalysis,
	SymbolInfo,
	SemanticRelation,
	FunctionAnalysis,
	ClassAnalysis,
	ImportAnalysis,
	ExportAnalysis,
	ComplexityMetrics,
	DependencyInfo,
	ISemanticAnalyzer,
	Position,
	Range,
	SymbolType,
	SymbolScope,
	RelationType,
	ParameterInfo,
	PropertyInfo,
} from "./interfaces"

// Supported language extensions
const SUPPORTED_EXTENSIONS: Record<string, string> = {
	".ts": "typescript",
	".tsx": "tsx",
	".js": "javascript",
	".jsx": "javascript",
	".py": "python",
	".java": "java",
	".go": "go",
	".rs": "rust",
	".rb": "ruby",
	".php": "php",
	".cpp": "cpp",
	".c": "c",
	".cs": "csharp",
}

export class SemanticAnalyzer implements ISemanticAnalyzer {
	private parsers: EnhancedLanguageParser | null = null
	private sourceDirectory?: string

	constructor(sourceDirectory?: string) {
		this.sourceDirectory = sourceDirectory
	}

	/**
	 * Get the list of supported languages
	 */
	getSupportedLanguages(): string[] {
		return Object.values(SUPPORTED_EXTENSIONS)
	}

	/**
	 * Get language from file extension
	 */
	private getLanguage(filePath: string): string | null {
		const ext = path.extname(filePath).toLowerCase()
		return SUPPORTED_EXTENSIONS[ext] || null
	}

	/**
	 * Ensure parsers are loaded for the given files
	 */
	private async ensureParsers(filePaths: string[]): Promise<void> {
		if (!this.parsers) {
			this.parsers = await loadEnhancedLanguageParsers(filePaths, this.sourceDirectory)
		}
	}

	/**
	 * Perform deep analysis on a file
	 */
	async analyzeDeep(filePath: string, content?: string): Promise<DeepAnalysis> {
		const language = this.getLanguage(filePath)

		if (!language) {
			throw new Error(`Unsupported file type: ${filePath}`)
		}

		// Read content if not provided
		const fileContent = content ?? (await fs.readFile(filePath, "utf-8"))
		const lines = fileContent.split("\n")

		// Ensure parsers are loaded
		await this.ensureParsers([filePath])

		const ext = path.extname(filePath).toLowerCase().slice(1)
		const parserInfo = this.parsers?.[ext]

		if (!parserInfo) {
			throw new Error(`No parser available for extension: ${ext}`)
		}

		const tree = parserInfo.parser.parse(fileContent)
		if (!tree) {
			throw new Error(`Failed to parse file: ${filePath}`)
		}
		const rootNode = tree.rootNode

		// Extract all components
		const symbols = this.extractSymbols(rootNode, fileContent, language)
		const functions = this.extractFunctions(rootNode, fileContent, language)
		const classes = this.extractClasses(rootNode, fileContent, language)
		const imports = this.extractImports(rootNode, fileContent, language)
		const exports = this.extractExports(rootNode, fileContent, language)
		const relations = await this.extractSemanticRelations(fileContent, language)
		const complexity = this.calculateComplexity(rootNode, lines)
		const dependencies = this.extractDependencies(imports, filePath)

		return {
			filePath,
			language,
			symbols,
			functions,
			classes,
			imports,
			exports,
			complexity,
			dependencies,
			relations,
			analyzedAt: new Date(),
		}
	}

	/**
	 * Extract semantic relations from code content
	 */
	async extractSemanticRelations(content: string, language: string): Promise<SemanticRelation[]> {
		const relations: SemanticRelation[] = []

		// Create a temporary file path for parsing
		const ext = this.getExtensionForLanguage(language)
		const tempPath = `temp.${ext}`

		await this.ensureParsers([tempPath])

		const parserInfo = this.parsers?.[ext]
		if (!parserInfo) {
			return relations
		}

		const tree = parserInfo.parser.parse(content)
		if (!tree) {
			return relations
		}
		const rootNode = tree.rootNode

		// Extract function calls
		this.extractCallRelations(rootNode, content, relations)

		// Extract class inheritance
		this.extractInheritanceRelations(rootNode, content, language, relations)

		// Extract imports
		this.extractImportRelations(rootNode, content, language, relations)

		return relations
	}

	/**
	 * Extract all symbols from AST
	 */
	private extractSymbols(node: any, content: string, language: string): SymbolInfo[] {
		const symbols: SymbolInfo[] = []
		const lines = content.split("\n")

		this.walkTree(node, (child) => {
			const symbolInfo = this.nodeToSymbol(child, lines, language)
			if (symbolInfo) {
				symbols.push(symbolInfo)
			}
		})

		return symbols
	}

	/**
	 * Convert AST node to SymbolInfo
	 */
	private nodeToSymbol(node: any, lines: string[], language: string): SymbolInfo | null {
		const type = node.type
		let symbolType: SymbolType | null = null
		let name: string | null = null
		let scope: SymbolScope = "module"

		// Determine symbol type based on node type
		switch (type) {
			case "function_declaration":
			case "function_definition":
			case "method_definition":
			case "arrow_function":
				symbolType = type === "method_definition" ? "method" : "function"
				name = this.getNodeName(node, "name", "identifier")
				scope = type === "method_definition" ? "class" : "module"
				break

			case "class_declaration":
			case "class_definition":
				symbolType = "class"
				name = this.getNodeName(node, "name", "identifier")
				scope = "module"
				break

			case "interface_declaration":
				symbolType = "interface"
				name = this.getNodeName(node, "name", "identifier")
				scope = "module"
				break

			case "variable_declarator":
			case "lexical_declaration":
				symbolType = "variable"
				name = this.getNodeName(node, "name", "identifier")
				scope = this.determineScope(node)
				break

			case "type_alias_declaration":
				symbolType = "type"
				name = this.getNodeName(node, "name", "identifier")
				scope = "module"
				break

			case "enum_declaration":
				symbolType = "enum"
				name = this.getNodeName(node, "name", "identifier")
				scope = "module"
				break

			default:
				return null
		}

		if (!name || !symbolType) {
			return null
		}

		const position: Position = {
			line: node.startPosition.row + 1,
			column: node.startPosition.column,
		}

		const range: Range = {
			start: position,
			end: {
				line: node.endPosition.row + 1,
				column: node.endPosition.column,
			},
		}

		return {
			name,
			type: symbolType,
			scope,
			position,
			range,
			references: [],
			documentation: this.extractDocumentation(node, lines),
		}
	}

	/**
	 * Extract functions from AST
	 */
	private extractFunctions(node: any, content: string, language: string): FunctionAnalysis[] {
		const functions: FunctionAnalysis[] = []
		const lines = content.split("\n")

		this.walkTree(node, (child) => {
			if (this.isFunctionNode(child, language)) {
				const funcAnalysis = this.analyzeFunctionNode(child, lines, language)
				if (funcAnalysis) {
					functions.push(funcAnalysis)
				}
			}
		})

		return functions
	}

	/**
	 * Extract classes from AST
	 */
	private extractClasses(node: any, content: string, language: string): ClassAnalysis[] {
		const classes: ClassAnalysis[] = []
		const lines = content.split("\n")

		this.walkTree(node, (child) => {
			if (this.isClassNode(child, language)) {
				const classAnalysis = this.analyzeClassNode(child, lines, language)
				if (classAnalysis) {
					classes.push(classAnalysis)
				}
			}
		})

		return classes
	}

	/**
	 * Extract imports from AST
	 */
	private extractImports(node: any, content: string, language: string): ImportAnalysis[] {
		const imports: ImportAnalysis[] = []

		this.walkTree(node, (child) => {
			const importInfo = this.analyzeImportNode(child, language)
			if (importInfo) {
				imports.push(importInfo)
			}
		})

		return imports
	}

	/**
	 * Extract exports from AST
	 */
	private extractExports(node: any, content: string, language: string): ExportAnalysis[] {
		const exports: ExportAnalysis[] = []

		this.walkTree(node, (child) => {
			const exportInfo = this.analyzeExportNode(child, language)
			if (exportInfo) {
				exports.push(exportInfo)
			}
		})

		return exports
	}

	/**
	 * Calculate complexity metrics
	 */
	private calculateComplexity(node: any, lines: string[]): ComplexityMetrics {
		let cyclomaticComplexity = 1 // Start with 1 for the main path
		let cognitiveComplexity = 0
		let linesOfComments = 0

		// Count complexity-increasing nodes
		this.walkTree(node, (child) => {
			const type = child.type

			// Cyclomatic complexity: count decision points
			if (
				["if_statement", "for_statement", "while_statement", "case", "catch_clause", "&&", "||", "?"].includes(
					type,
				)
			) {
				cyclomaticComplexity++
			}

			// Cognitive complexity: nested structures add more
			if (["if_statement", "for_statement", "while_statement", "try_statement"].includes(type)) {
				const depth = this.getNodeDepth(child)
				cognitiveComplexity += 1 + Math.max(0, depth - 1)
			}

			// Count comments
			if (type === "comment" || type === "line_comment" || type === "block_comment") {
				linesOfComments++
			}
		})

		const linesOfCode = lines.filter((line) => line.trim().length > 0).length

		// Calculate maintainability index (simplified version)
		// MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)
		// Simplified: higher is better, max 100
		const maintainabilityIndex = Math.max(
			0,
			Math.min(100, 171 - 5.2 * Math.log(linesOfCode + 1) - 0.23 * cyclomaticComplexity),
		)

		return {
			cyclomaticComplexity,
			cognitiveComplexity,
			linesOfCode,
			linesOfComments,
			maintainabilityIndex: Math.round(maintainabilityIndex),
		}
	}

	/**
	 * Extract dependencies from imports
	 */
	private extractDependencies(imports: ImportAnalysis[], filePath: string): DependencyInfo[] {
		return imports.map((imp) => ({
			filePath: imp.modulePath,
			type: imp.isRelative ? "internal" : (imp.modulePath.startsWith("@") ? "external" : "builtin"),
			importedSymbols: imp.importedSymbols.map((s) => s.name),
		}))
	}

	/**
	 * Extract call relations from AST
	 */
	private extractCallRelations(node: any, content: string, relations: SemanticRelation[]): void {
		this.walkTree(node, (child) => {
			if (child.type === "call_expression") {
				const callee = child.childForFieldName("function")
				if (callee) {
					const callerFunc = this.findEnclosingFunction(child)
					if (callerFunc) {
						relations.push({
							source: {
								name: callerFunc,
								type: "function",
								scope: "module",
								position: { line: child.startPosition.row + 1, column: child.startPosition.column },
								references: [],
							},
							target: {
								name: callee.text,
								type: "function",
								scope: "module",
								position: { line: callee.startPosition.row + 1, column: callee.startPosition.column },
								references: [],
							},
							relationType: "calls",
							strength: 1.0,
						})
					}
				}
			}
		})
	}

	/**
	 * Extract inheritance relations
	 */
	private extractInheritanceRelations(
		node: any,
		content: string,
		language: string,
		relations: SemanticRelation[],
	): void {
		this.walkTree(node, (child) => {
			if (this.isClassNode(child, language)) {
				const className = this.getNodeName(child, "name", "identifier")
				const extendsClause = child.childForFieldName("superclass") || this.findChild(child, "extends_clause")

				if (className && extendsClause) {
					const parentName = this.extractClassName(extendsClause)
					if (parentName) {
						relations.push({
							source: {
								name: className,
								type: "class",
								scope: "module",
								position: { line: child.startPosition.row + 1, column: child.startPosition.column },
								references: [],
							},
							target: {
								name: parentName,
								type: "class",
								scope: "module",
								position: {
									line: extendsClause.startPosition.row + 1,
									column: extendsClause.startPosition.column,
								},
								references: [],
							},
							relationType: "extends",
							strength: 1.0,
						})
					}
				}
			}
		})
	}

	/**
	 * Extract import relations
	 */
	private extractImportRelations(
		node: any,
		content: string,
		language: string,
		relations: SemanticRelation[],
	): void {
		this.walkTree(node, (child) => {
			const importInfo = this.analyzeImportNode(child, language)
			if (importInfo) {
				for (const symbol of importInfo.importedSymbols) {
					relations.push({
						source: {
							name: symbol.alias || symbol.name,
							type: symbol.isType ? "type" : "variable",
							scope: "module",
							position: { line: child.startPosition.row + 1, column: child.startPosition.column },
							references: [],
						},
						target: {
							name: symbol.name,
							type: symbol.isType ? "type" : "variable",
							scope: "module",
							position: { line: child.startPosition.row + 1, column: child.startPosition.column },
							references: [],
						},
						relationType: "imports",
						strength: 1.0,
						metadata: { modulePath: importInfo.modulePath },
					})
				}
			}
		})
	}

	// ============================================================================
	// Helper Methods
	// ============================================================================

	private walkTree(node: any, callback: (node: any) => void): void {
		callback(node)
		for (let i = 0; i < node.childCount; i++) {
			this.walkTree(node.child(i), callback)
		}
	}

	private getNodeName(node: any, ...fieldNames: string[]): string | null {
		for (const fieldName of fieldNames) {
			const child = node.childForFieldName(fieldName)
			if (child) {
				return child.text
			}
		}

		// Try to find an identifier child
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (child.type === "identifier" || child.type === "property_identifier") {
				return child.text
			}
		}

		return null
	}

	private findChild(node: any, type: string): any | null {
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (child.type === type) {
				return child
			}
		}
		return null
	}

	private isFunctionNode(node: any, language: string): boolean {
		const functionTypes = [
			"function_declaration",
			"function_definition",
			"method_definition",
			"arrow_function",
			"function_expression",
		]
		return functionTypes.includes(node.type)
	}

	private isClassNode(node: any, language: string): boolean {
		const classTypes = ["class_declaration", "class_definition", "class"]
		return classTypes.includes(node.type)
	}

	private analyzeImportNode(node: any, language: string): ImportAnalysis | null {
		if (node.type !== "import_statement" && node.type !== "import_declaration") {
			return null
		}

		const source = node.childForFieldName("source")
		if (!source) {
			return null
		}

		const modulePath = source.text.replace(/['"]/g, "")
		const isRelative = modulePath.startsWith(".") || modulePath.startsWith("/")

		const importedSymbols: { name: string; alias?: string; isType: boolean }[] = []
		let isDefault = false
		let isNamespace = false

		// Find import clause
		this.walkTree(node, (child) => {
			if (child.type === "import_specifier") {
				const name = child.childForFieldName("name")?.text || child.text
				const alias = child.childForFieldName("alias")?.text
				importedSymbols.push({ name, alias, isType: false })
			} else if (child.type === "identifier" && child.parent?.type === "import_clause") {
				isDefault = true
				importedSymbols.push({ name: child.text, isType: false })
			} else if (child.type === "namespace_import") {
				isNamespace = true
			}
		})

		return {
			modulePath,
			isRelative,
			importedSymbols,
			isDefault,
			isNamespace,
		}
	}

	private analyzeExportNode(node: any, language: string): ExportAnalysis | null {
		if (!node.type.includes("export")) {
			return null
		}

		const isDefault = node.type.includes("default")
		let name = "default"
		let symbolType: SymbolType = "variable"

		this.walkTree(node, (child) => {
			if (child.type === "function_declaration" || child.type === "function_definition") {
				symbolType = "function"
				name = this.getNodeName(child, "name", "identifier") || "anonymous"
			} else if (child.type === "class_declaration" || child.type === "class_definition") {
				symbolType = "class"
				name = this.getNodeName(child, "name", "identifier") || "anonymous"
			} else if (child.type === "identifier" && child.parent === node) {
				name = child.text
			}
		})

		return {
			name,
			type: symbolType,
			isDefault,
			isReExport: node.type === "export_statement" && node.childForFieldName("source") !== null,
		}
	}

	private analyzeFunctionNode(node: any, lines: string[], language: string): FunctionAnalysis | null {
		const name = this.getNodeName(node, "name", "identifier") || "anonymous"

		const parameters: ParameterInfo[] = []
		const params = node.childForFieldName("parameters")
		if (params) {
			this.walkTree(params, (child) => {
				if (
					child.type === "identifier" ||
					child.type === "required_parameter" ||
					child.type === "optional_parameter"
				) {
					parameters.push({
						name: child.text,
						isOptional: child.type === "optional_parameter",
						isRest: false,
					})
				}
			})
		}

		const position: Position = {
			line: node.startPosition.row + 1,
			column: node.startPosition.column,
		}

		const range: Range = {
			start: position,
			end: {
				line: node.endPosition.row + 1,
				column: node.endPosition.column,
			},
		}

		const isAsync = node.text.includes("async") || this.findChild(node, "async") !== null
		const isGenerator = node.text.includes("*") || this.findChild(node, "generator") !== null

		// Extract function calls
		const calls: string[] = []
		this.walkTree(node, (child) => {
			if (child.type === "call_expression") {
				const callee = child.childForFieldName("function")
				if (callee && callee.text) {
					calls.push(callee.text)
				}
			}
		})

		return {
			name,
			signature: this.extractSignature(node, lines),
			parameters,
			isAsync,
			isGenerator,
			complexity: this.calculateNodeComplexity(node),
			lineCount: range.end.line - range.start.line + 1,
			calls: [...new Set(calls)],
			position,
			range,
			documentation: this.extractDocumentation(node, lines),
		}
	}

	private analyzeClassNode(node: any, lines: string[], language: string): ClassAnalysis | null {
		const name = this.getNodeName(node, "name", "identifier")
		if (!name) return null

		let extendsName: string | undefined
		const implementsList: string[] = []
		const properties: PropertyInfo[] = []
		const methods: FunctionAnalysis[] = []

		// Find extends and implements
		this.walkTree(node, (child) => {
			if (child.type === "extends_clause" || child.type === "superclass") {
				extendsName = this.extractClassName(child) ?? undefined
			} else if (child.type === "implements_clause") {
				this.walkTree(child, (impl) => {
					if (impl.type === "type_identifier") {
						implementsList.push(impl.text)
					}
				})
			} else if (child.type === "method_definition" || child.type === "method_declaration") {
				const method = this.analyzeFunctionNode(child, lines, language)
				if (method) {
					methods.push(method)
				}
			} else if (child.type === "public_field_definition" || child.type === "property_definition") {
				const propName = this.getNodeName(child, "name", "identifier")
				if (propName) {
					properties.push({
						name: propName,
						visibility: "public",
						isStatic: child.text.includes("static"),
						isReadonly: child.text.includes("readonly"),
					})
				}
			}
		})

		const position: Position = {
			line: node.startPosition.row + 1,
			column: node.startPosition.column,
		}

		const range: Range = {
			start: position,
			end: {
				line: node.endPosition.row + 1,
				column: node.endPosition.column,
			},
		}

		return {
			name,
			extends: extendsName,
			implements: implementsList,
			properties,
			methods,
			isAbstract: node.text.includes("abstract"),
			position,
			range,
			documentation: this.extractDocumentation(node, lines),
		}
	}

	private extractClassName(node: any): string | null {
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (child.type === "identifier" || child.type === "type_identifier") {
				return child.text
			}
		}
		return null
	}

	private findEnclosingFunction(node: any): string | null {
		let current = node.parent
		while (current) {
			if (this.isFunctionNode(current, "")) {
				return this.getNodeName(current, "name", "identifier")
			}
			current = current.parent
		}
		return null
	}

	private determineScope(node: any): SymbolScope {
		let current = node.parent
		while (current) {
			if (this.isClassNode(current, "")) return "class"
			if (this.isFunctionNode(current, "")) return "function"
			current = current.parent
		}
		return "module"
	}

	private getNodeDepth(node: any): number {
		let depth = 0
		let current = node.parent
		while (current) {
			if (["if_statement", "for_statement", "while_statement", "try_statement"].includes(current.type)) {
				depth++
			}
			current = current.parent
		}
		return depth
	}

	private calculateNodeComplexity(node: any): number {
		let complexity = 1
		this.walkTree(node, (child) => {
			if (["if_statement", "for_statement", "while_statement", "case", "catch_clause"].includes(child.type)) {
				complexity++
			}
		})
		return complexity
	}

	private extractSignature(node: any, lines: string[]): string {
		const startLine = node.startPosition.row
		const firstLine = lines[startLine] || ""

		// Extract up to the opening brace
		const braceIndex = firstLine.indexOf("{")
		if (braceIndex > 0) {
			return firstLine.substring(0, braceIndex).trim()
		}
		return firstLine.trim()
	}

	private extractDocumentation(node: any, lines: string[]): string | undefined {
		const prevLine = node.startPosition.row - 1
		if (prevLine < 0) return undefined

		const line = lines[prevLine]?.trim()
		if (line?.startsWith("//") || line?.startsWith("*") || line?.startsWith("/**")) {
			// Collect documentation comments
			const docs: string[] = []
			let i = prevLine
			while (i >= 0 && (lines[i]?.trim().startsWith("//") || lines[i]?.trim().startsWith("*"))) {
				docs.unshift(lines[i].trim())
				i--
			}
			return docs.join("\n")
		}

		return undefined
	}

	private getExtensionForLanguage(language: string): string {
		const langToExt: Record<string, string> = {
			typescript: "ts",
			javascript: "js",
			python: "py",
			java: "java",
			go: "go",
			rust: "rs",
			ruby: "rb",
			php: "php",
			cpp: "cpp",
			c: "c",
			csharp: "cs",
			tsx: "tsx",
		}
		return langToExt[language] || "ts"
	}
}
