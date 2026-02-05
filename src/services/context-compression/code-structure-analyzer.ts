/**
 * Code Structure Analyzer
 *
 * Analyzes code structure to identify essential elements like functions, classes,
 * imports, and exports for intelligent compression.
 */

import type { FunctionInfo, ClassInfo, ImportInfo, ExportInfo, PropertyInfo, ParameterInfo } from "./interfaces"

/**
 * Language patterns for different programming languages
 */
interface LanguagePatterns {
	functionRegex: RegExp
	classRegex: RegExp
	importRegex: RegExp
	exportRegex: RegExp
	commentRegex: RegExp
	docCommentRegex: RegExp
	parameterRegex: RegExp
}

/**
 * Default language patterns for TypeScript/JavaScript
 */
const TYPESCRIPT_PATTERNS: LanguagePatterns = {
	functionRegex:
		/(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?function|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>|(\w+)\s*\([^)]*\)\s*\{)/g,
	classRegex: /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g,
	importRegex:
		/import\s+(?:\{[^}]*\}|\* as \w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\* as \w+|\w+))*\s*from\s*['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g,
	exportRegex:
		/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)|export\s+\{[^}]*\}/g,
	commentRegex: /\/\/.*$|\/\*[\s\S]*?\*\//g,
	docCommentRegex: /\/\*\*[\s\S]*?\*\/\s*/g,
	parameterRegex: /(\w+)(?:\?\s*)?(?:\s*:\s*[\w\[\]<>|,.\s{}]+)?/g,
}

/**
 * Python language patterns
 */
const PYTHON_PATTERNS: LanguagePatterns = {
	functionRegex: /(?:async\s+)?def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[\w\[\]<>|,.\s{}]+)?\s*:/g,
	classRegex: /class\s+(\w+)(?:\s*\(\s*[\w,\s.]+\s*\))?\s*:/g,
	importRegex: /(?:from\s+(\w+(?:\.\w+)*)\s+)?import\s+(?:(?:\w+)(?:\s*,\s*\w+)*|\*\s+as\s+\w+|\w+\s+as\s+\w+)/g,
	exportRegex: /__all__\s*=\s*\[([^\]]+)\]/g,
	commentRegex: /#.*$/gm,
	docCommentRegex: /["""][\s\S]*?"""\s*/g,
	parameterRegex: /(\w+)(?:\s*:\s*[\w\[\]<>|,.\s{}]+)?(?:\s*=\s*[^,\)]+)?/g,
}

/**
 * Java language patterns
 */
const JAVA_PATTERNS: LanguagePatterns = {
	functionRegex:
		/(?:public|private|protected|static|final|synchronized|native)\s+[\w\[\]<>|,.\s{}]*\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g,
	classRegex:
		/(?:public|private|protected|static|final|abstract)\s+class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g,
	importRegex: /import\s+(?:static\s+)?(?:[a-zA-Z0-9_.]+\.)*(\*|[a-zA-Z0-9_]+)\s*;/g,
	exportRegex: /public\s+(?:class|interface|enum|annotation)\s+(\w+)/g,
	commentRegex: /\/\/.*$|\/\*[\s\S]*?\*\//g,
	docCommentRegex: /\/\*\*[\s\S]*?\*\/\s*/g,
	parameterRegex: /(\w+)(?:\s*:\s*[\w\[\]<>|,.\s{}]+)?/g,
}

/**
 * C/C++ language patterns
 */
const C_CPP_PATTERNS: LanguagePatterns = {
	functionRegex: /(?:static|inline|constexpr|virtual)\s*[\w\[\]<>*,.\s{}]*\s+(\w+)\s*\([^)]*\)\s*(?:const)?\s*\{/g,
	classRegex:
		/(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+\w+(?:\s*,\s*(?:public|private|protected)\s+\w+)*)?\s*\{/g,
	importRegex: /#include\s*(?:<[^>]+>|"[^"]+")/g,
	exportRegex: /(?:class|struct)\s+(\w+)/g,
	commentRegex: /\/\/.*$|\/\*[\s\S]*?\*\//g,
	docCommentRegex: /\/\*\*[\s\S]*?\*\/\s*/g,
	parameterRegex: /(\w+)(?:\s*:\s*[\w\[\]<>*,.\s{}]+)?/g,
}

/**
 * Get language patterns based on file extension
 * @param language - Programming language
 * @returns Language patterns
 */
function getLanguagePatterns(language: string): LanguagePatterns {
	const lang = language.toLowerCase()
	switch (lang) {
		case "python":
		case "py":
			return PYTHON_PATTERNS
		case "java":
		case "kt":
		case "scala":
			return JAVA_PATTERNS
		case "c":
		case "cpp":
		case "h":
		case "hpp":
		case "cc":
		case "cxx":
			return C_CPP_PATTERNS
		case "typescript":
		case "javascript":
		case "tsx":
		case "jsx":
		default:
			return TYPESCRIPT_PATTERNS
	}
}

/**
 * Detect language from file extension
 * @param filePath - File path
 * @returns Detected language
 */
function detectLanguage(filePath: string): string {
	const extension = filePath.split(".").pop()?.toLowerCase() || ""
	switch (extension) {
		case "py":
			return "python"
		case "java":
		case "kt":
		case "kts":
			return "java"
		case "c":
		case "cpp":
		case "h":
		case "hpp":
		case "cc":
		case "cxx":
			return "cpp"
		case "ts":
		case "tsx":
			return "typescript"
		case "js":
		case "jsx":
			return "javascript"
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
		default:
			return "typescript"
	}
}

/**
 * Count lines in text
 * @param text - Text to count lines
 * @returns Line count
 */
function countLines(text: string): number {
	if (!text) return 0
	return text.split("\n").length
}

/**
 * CodeStructureAnalyzer class
 * Analyzes code structure to identify essential elements
 */
export class CodeStructureAnalyzer {
	private patterns: LanguagePatterns
	private language: string

	/**
	 * Create a new CodeStructureAnalyzer
	 * @param language - Programming language (auto-detected if not provided)
	 */
	constructor(language?: string) {
		this.language = language || "typescript"
		this.patterns = getLanguagePatterns(this.language)
	}

	/**
	 * Extract all functions from code
	 * @param code - Code to analyze
	 * @returns Array of FunctionInfo objects
	 */
	extractFunctions(code: string): FunctionInfo[] {
		const functions: FunctionInfo[] = []
		const lines = code.split("\n")
		let match

		// Reset regex state
		const regex = new RegExp(this.patterns.functionRegex)

		// TypeScript/JavaScript function detection
		if (this.language === "typescript" || this.language === "javascript") {
			const funcPatterns = [
				/(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
				/(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
				/const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/g,
				/(\w+)\s*\(([^)]*)\)\s*=>/g,
			]

			for (const pattern of funcPatterns) {
				while ((match = pattern.exec(code)) !== null) {
					const startLine = countLines(code.substring(0, match.index))
					const signature = match[0]
					const name = match[1]
					const params = this.extractParameters(match[2] || "")
					const body = this.getFunctionBodyFromSignature(code, match.index, signature)
					const docComment = this.extractDocCommentBefore(code, match.index)
					const isAsync = signature.includes("async")

					functions.push({
						name,
						signature,
						startLine,
						endLine: startLine + countLines(body),
						body,
						docComment,
						isAsync,
						isGenerator: signature.includes("*"),
						parameters: params,
					})
				}
			}
		} else if (this.language === "python") {
			const pyPattern = /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/g
			while ((match = pyPattern.exec(code)) !== null) {
				const startLine = countLines(code.substring(0, match.index))
				const name = match[1]
				const params = this.extractPythonParameters(match[2])
				const body = this.getPythonFunctionBody(code, match.index)
				const docComment = this.extractPythonDocComment(lines, startLine - 1)

				functions.push({
					name,
					signature: match[0],
					startLine,
					endLine: startLine + countLines(body),
					body,
					docComment,
					isAsync: match[0].includes("async"),
					isGenerator: false,
					parameters: params,
				})
			}
		} else {
			// Generic Java/C++ function detection
			while ((match = regex.exec(code)) !== null) {
				const startLine = countLines(code.substring(0, match.index))
				const name = match[1]
				const body = this.getFunctionBodyFromSignature(code, match.index, match[0])

				functions.push({
					name,
					signature: match[0],
					startLine,
					endLine: startLine + countLines(body),
					body,
					docComment: undefined,
					isAsync: false,
					isGenerator: false,
					parameters: [],
				})
			}
		}

		return functions
	}

	/**
	 * Extract all classes from code
	 * @param code - Code to analyze
	 * @returns Array of ClassInfo objects
	 */
	extractClasses(code: string): ClassInfo[] {
		const classes: ClassInfo[] = []
		const regex = new RegExp(this.patterns.classRegex)
		let match

		while ((match = regex.exec(code)) !== null) {
			const startLine = countLines(code.substring(0, match.index))
			const className = match[1]
			const extendsClause = this.extractExtendsClause(match[0])
			const implementsClauses = this.extractImplementsClauses(match[0])
			const body = this.getClassBody(code, match.index)
			const methods = this.extractClassMethods(body)
			const properties = this.extractClassProperties(body)
			const docComment = this.extractDocCommentBefore(code, match.index)

			classes.push({
				name: className,
				signature: match[0],
				startLine,
				endLine: startLine + countLines(body),
				body,
				docComment,
				extendsClause,
				implementsClauses,
				methods,
				properties,
			})
		}

		return classes
	}

	/**
	 * Extract all imports from code
	 * @param code - Code to analyze
	 * @returns Array of ImportInfo objects
	 */
	extractImports(code: string): ImportInfo[] {
		const imports: ImportInfo[] = []
		const regex = new RegExp(this.patterns.importRegex)
		let match

		while ((match = regex.exec(code)) !== null) {
			const importType = this.determineImportType(match[0])
			const path = match[1] || match[2] || ""
			const importedNames = this.extractImportedNames(match[0])
			const aliases = this.extractAliases(match[0])

			if (path) {
				imports.push({
					path,
					importType,
					importedNames,
					aliases,
				})
			}
		}

		return imports
	}

	/**
	 * Extract all exports from code
	 * @param code - Code to analyze
	 * @returns Array of ExportInfo objects
	 */
	extractExports(code: string): ExportInfo[] {
		const exports: ExportInfo[] = []
		const regex = new RegExp(this.patterns.exportRegex)
		let match

		while ((match = regex.exec(code)) !== null) {
			const exportType = this.determineExportType(match[0])
			const exportedName = match[1] || this.extractNamedExports(match[0])

			exports.push({
				exportType,
				exportedName,
				targetPath: undefined,
			})
		}

		return exports
	}

	/**
	 * Get function body based on signature
	 * @param code - Full code
	 * @param signatureIndex - Index of function signature
	 * @param signature - Function signature text
	 * @returns Function body
	 */
	getFunctionBody(code: string, signatureIndex: number): string {
		return this.getFunctionBodyFromSignature(
			code,
			signatureIndex,
			code.substring(signatureIndex, signatureIndex + 200),
		)
	}

	/**
	 * Get class body based on class declaration
	 * @param code - Full code
	 * @param classIndex - Index of class declaration
	 * @returns Class body
	 */
	getClassBody(code: string, classIndex: number): string {
		const content = code.substring(classIndex)
		let braceCount = 0
		let endIndex = 0
		let foundFirstBrace = false

		for (let i = 0; i < content.length; i++) {
			if (content[i] === "{") {
				braceCount++
				foundFirstBrace = true
			} else if (content[i] === "}") {
				braceCount--
				if (foundFirstBrace && braceCount === 0) {
					endIndex = i + 1
					break
				}
			}
		}

		return content.substring(0, endIndex)
	}

	/**
	 * Check if a line is essential (signatures, docs, types)
	 * @param line - Line to check
	 * @returns True if line is essential
	 */
	isEssentialLine(line: string): boolean {
		const trimmed = line.trim()

		// Essential patterns
		const essentialPatterns = [
			/^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var|def|class)\s+/,
			/^import\s+.*from\s+/,
			/^export\s+/,
			/^\s*@\w+/, // Decorators/annotations
			/^\s*\/\*\*[\s\S]*?\*\//, // Doc comments
			/^\s*\/\/.*@/, // Comments with annotations
			/^(?:public|private|protected|static|readonly|async|override)\s+/, // Access modifiers
			/^\s*#(?:export|import)/, // Python exports/imports
		]

		return essentialPatterns.some((pattern) => pattern.test(trimmed))
	}

	/**
	 * Extract parameters from function signature
	 * @param paramsString - Parameters string
	 * @returns Array of ParameterInfo
	 */
	private extractParameters(paramsString: string): ParameterInfo[] {
		const params: ParameterInfo[] = []
		const paramRegex = /(\w+)(?:\?\s*)?(?:\s*:\s*([\w\[\]<>|,.\s{}]+))?/g
		let match

		while ((match = paramRegex.exec(paramsString)) !== null) {
			params.push({
				name: match[1],
				type: match[2] || "any",
				isOptional: paramsString.includes(`${match[1]}?`),
			})
		}

		return params
	}

	/**
	 * Extract Python parameters
	 * @param paramsString - Parameters string
	 * @returns Array of ParameterInfo
	 */
	private extractPythonParameters(paramsString: string): ParameterInfo[] {
		const params: ParameterInfo[] = []
		const parts = paramsString
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p)

		for (const part of parts) {
			const withDefault = part.split("=")
			const nameType = withDefault[0].split(":")
			const name = nameType[0].trim()
			const type = nameType[1]?.trim() || "Any"
			const defaultValue = withDefault[1]?.trim()

			params.push({
				name,
				type,
				isOptional: part.includes("=") || part.includes("None"),
				defaultValue,
			})
		}

		return params
	}

	/**
	 * Get function body from signature
	 */
	private getFunctionBodyFromSignature(code: string, startIndex: number, signature: string): string {
		const content = code.substring(startIndex)
		let braceCount = 0
		let startFound = false
		let endIndex = 0

		for (let i = 0; i < content.length; i++) {
			if (content[i] === "{") {
				if (!startFound) {
					startFound = true
					braceCount = 1
				} else {
					braceCount++
				}
			} else if (content[i] === "}") {
				braceCount--
				if (startFound && braceCount === 0) {
					endIndex = i + 1
					break
				}
			}
		}

		if (!startFound) {
			// Try arrow function or Python
			if (content.includes("=>")) {
				const arrowIndex = content.indexOf("=>")
				return content.substring(arrowIndex + 2, arrowIndex + 100).trim()
			}
			return ""
		}

		return content.substring(0, endIndex)
	}

	/**
	 * Get Python function body
	 */
	private getPythonFunctionBody(code: string, startIndex: number): string {
		const content = code.substring(startIndex)
		const lines = content.split("\n")
		let bodyLines: string[] = []
		let inFunction = false
		let indentLevel = -1

		for (const line of lines) {
			if (!inFunction) {
				if (line.includes(":")) {
					inFunction = true
					indentLevel = line.search(/\S/)
					bodyLines.push(line)
				}
			} else {
				const currentIndent = line.search(/\S/)
				if (currentIndent > indentLevel) {
					bodyLines.push(line)
				} else {
					break
				}
			}
		}

		return bodyLines.join("\n")
	}

	/**
	 * Extract documentation comment before position
	 */
	private extractDocCommentBefore(code: string, position: number): string | undefined {
		const beforeCode = code.substring(0, position)
		const lines = beforeCode.split("\n")
		let docComment = ""
		let foundDocStart = false

		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i].trim()
			if (line.startsWith("/**")) {
				foundDocStart = true
				docComment = line + "\n" + docComment
				break
			} else if (foundDocStart && (line.startsWith("*") || line.trim() === "")) {
				docComment = line + "\n" + docComment
			} else if (foundDocStart && !line.startsWith("*")) {
				break
			}
		}

		return docComment || undefined
	}

	/**
	 * Extract Python docstring
	 */
	private extractPythonDocComment(lines: string[], startLine: number): string | undefined {
		let docstring = ""
		let foundDocstring = false
		let lineIndex = startLine - 1

		while (lineIndex >= 0) {
			const line = lines[lineIndex].trim()
			if (line.startsWith('"""') || line.startsWith("'''")) {
				if (!foundDocstring) {
					foundDocstring = true
					docstring = line
				} else {
					docstring = line + "\n" + docstring
					break
				}
			} else if (foundDocstring) {
				docstring = lines[lineIndex] + "\n" + docstring
			} else if (line !== "" && !line.startsWith("#")) {
				break
			}
			lineIndex--
		}

		return docstring || undefined
	}

	/**
	 * Extract extends clause
	 */
	private extractExtendsClause(classDecl: string): string | undefined {
		const match = classDecl.match(/extends\s+(\w+)/)
		return match ? match[1] : undefined
	}

	/**
	 * Extract implements clauses
	 */
	private extractImplementsClauses(classDecl: string): string[] {
		const match = classDecl.match(/implements\s+([\w,\s]+)/)
		return match ? match[1].split(",").map((s) => s.trim()) : []
	}

	/**
	 * Extract class methods
	 */
	private extractClassMethods(classBody: string): FunctionInfo[] {
		const analyzer = new CodeStructureAnalyzer(this.language)
		return analyzer.extractFunctions(classBody)
	}

	/**
	 * Extract class properties
	 */
	private extractClassProperties(classBody: string): PropertyInfo[] {
		const properties: PropertyInfo[] = []
		const lines = classBody.split("\n")

		for (const line of lines) {
			const trimmed = line.trim()
			const propMatch = trimmed.match(
				/^(?:public|private|protected|static|readonly)?\s*(?:readonly)?\s*(\w+)\s*(?:\?\s*)?(?:\s*:\s*[\w\[\]<>|,.\s{}]+)?/,
			)

			if (propMatch && !trimmed.startsWith("constructor") && !trimmed.includes("(")) {
				const accessMatch = trimmed.match(/^(public|private|protected)/)
				properties.push({
					name: propMatch[1],
					type: "unknown",
					isReadonly: trimmed.includes("readonly"),
					isStatic: trimmed.includes("static"),
					accessModifier: accessMatch ? (accessMatch[1] as "public" | "private" | "protected") : undefined,
				})
			}
		}

		return properties
	}

	/**
	 * Determine import type
	 */
	private determineImportType(importStatement: string): "default" | "named" | "namespace" | "sideEffect" {
		if (importStatement.includes("* as")) {
			return "namespace"
		}
		if (importStatement.includes("{")) {
			return "named"
		}
		if (importStatement.match(/import\s+['"]\s*['"]/)) {
			return "sideEffect"
		}
		return "default"
	}

	/**
	 * Extract imported names from import statement
	 */
	private extractImportedNames(importStatement: string): string[] {
		const names: string[] = []

		if (importStatement.includes("{")) {
			const match = importStatement.match(/\{([^}]+)\}/)
			if (match) {
				names.push(...match[1].split(",").map((n) => n.trim().split(" as ")[0].trim()))
			}
		} else {
			const match = importStatement.match(/import\s+(\w+)/)
			if (match) {
				names.push(match[1])
			}
		}

		return names
	}

	/**
	 * Extract aliases from import statement
	 */
	private extractAliases(importStatement: string): Record<string, string> {
		const aliases: Record<string, string> = {}

		if (importStatement.includes(" as ")) {
			const namedMatch = importStatement.match(/\{([^}]+)\}/)
			if (namedMatch) {
				for (const part of namedMatch[1].split(",")) {
					const [name, alias] = part.trim().split(" as ")
					if (alias) {
						aliases[name.trim()] = alias.trim()
					}
				}
			}

			const namespaceMatch = importStatement.match(/\*\s+as\s+(\w+)/)
			if (namespaceMatch) {
				const pathMatch = importStatement.match(/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/)
				if (pathMatch) {
					aliases[pathMatch[1]] = namespaceMatch[1]
				}
			}
		}

		return aliases
	}

	/**
	 * Determine export type
	 */
	private determineExportType(exportStatement: string): "named" | "default" | "reexport" {
		if (exportStatement.includes("default")) {
			return "default"
		}
		if (exportStatement.includes("export {") && exportStatement.includes("from")) {
			return "reexport"
		}
		return "named"
	}

	/**
	 * Extract named exports from export statement
	 */
	private extractNamedExports(exportStatement: string): string {
		const match = exportStatement.match(/export\s+\{([^}]+)\}/)
		return match ? match[1].split(",")[0].trim() : ""
	}
}

/**
 * Analyze code structure and return essential elements
 * @param code - Code to analyze
 * @param language - Programming language
 * @returns Object containing extracted functions, classes, imports, and exports
 */
export function analyzeCodeStructure(
	code: string,
	language?: string,
): {
	functions: FunctionInfo[]
	classes: ClassInfo[]
	imports: ImportInfo[]
	exports: ExportInfo[]
} {
	const analyzer = new CodeStructureAnalyzer(language)
	return {
		functions: analyzer.extractFunctions(code),
		classes: analyzer.extractClasses(code),
		imports: analyzer.extractImports(code),
		exports: analyzer.extractExports(code),
	}
}
