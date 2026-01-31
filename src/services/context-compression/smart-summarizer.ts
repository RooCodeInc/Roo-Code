/**
 * Smart Summarizer
 *
 * Provides intelligent summarization of code sections while preserving
 * essential information and semantics.
 */

import type {
	SummarizedFile,
	SummarizedClass,
	SummarizedFunction,
	FunctionInfo,
	ClassInfo,
	ImportInfo,
	ExportInfo,
	CompressionConfig,
} from "./interfaces"
import { CodeStructureAnalyzer, analyzeCodeStructure } from "./code-structure-analyzer"

/**
 * Keywords that indicate essential code elements
 */
const ESSENTIAL_KEYWORDS = [
	"return",
	"throw",
	"return",
	"async",
	"await",
	"yield",
	"new",
	"delete",
	"instanceof",
	"typeof",
	"import",
]

/**
 * Statements that should be preserved
 */
const PRESERVE_STATEMENTS = [
	/return\s+/,
	/throw\s+/,
	/^\s*if\s*\(/,
	/^\s*for\s*\(/,
	/^\s*while\s*\(/,
	/^\s*switch\s*\(/,
	/^\s*try\s*\{/,
	/^\s*catch\s*\(/,
	/^\s*finally\s*\{/,
	/^\s*async\s+/,
	/^\s*await\s+/,
]

/**
 * Detect programming language from file content
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
			case "kt":
				return "kotlin"
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
		}
	}

	// Detect from content
	if (content.includes("def ") && content.includes(":")) {
		return "python"
	}
	if (content.includes("public class") || content.includes("import java.")) {
		return "java"
	}
	if (content.includes("func ") && content.includes("{")) {
		return "swift"
	}
	if (content.includes("fn ") && content.includes("}")) {
		return "rust"
	}
	if (content.includes("function ") && content.includes("(")) {
		return "typescript"
	}

	return "typescript"
}

/**
 * Count lines in text
 * @param text - Text to count
 * @returns Line count
 */
function countLines(text: string): number {
	if (!text) return 0
	return text.split("\n").length
}

/**
 * Check if line contains essential keyword
 * @param line - Line to check
 * @returns True if line contains essential keyword
 */
function hasEssentialKeyword(line: string): boolean {
	return ESSENTIAL_KEYWORDS.some((keyword) => line.includes(keyword))
}

/**
 * Check if line should be preserved
 * @param line - Line to check
 * @returns True if line should be preserved
 */
function shouldPreserveLine(line: string): boolean {
	return PRESERVE_STATEMENTS.some((pattern) => pattern.test(line))
}

/**
 * Summarize a function body by extracting essential logic
 * @param funcContent - Function content
 * @param config - Compression configuration
 * @returns Summarized function
 */
function summarizeFunctionBody(funcContent: string, config: CompressionConfig): string {
	const lines = funcContent.split("\n")
	const preservedLines: string[] = []
	const summaryLines: string[] = []
	let braceCount = 0
	let inFunction = false
	let essentialCount = 0
	const essentialThreshold = 5 // Preserve up to 5 essential lines

	for (const line of lines) {
		const trimmed = line.trim()

		// Track brace count for block detection
		braceCount += (trimmed.match(/\{/g) || []).length
		braceCount -= (trimmed.match(/\}/g) || []).length

		// Detect function body start
		if (trimmed.endsWith("{") || trimmed.includes("=>")) {
			inFunction = true
		}

		// Preserve essential lines
		if (inFunction && essentialCount < essentialThreshold) {
			if (shouldPreserveLine(trimmed) || hasEssentialKeyword(trimmed)) {
				preservedLines.push(line)
				essentialCount++
				continue
			}
		}

		// Add summary for blocks
		if (trimmed.includes("{") && braceCount > 1 && inFunction) {
			const summary = generateBlockSummary(trimmed)
			if (summary) {
				summaryLines.push(`    // ${summary}`)
			}
		}
	}

	// Combine preserved lines and summaries
	return [...preservedLines, ...summaryLines].join("\n")
}

/**
 * Generate a summary for a code block
 * @param line - Code line
 * @returns Summary string
 */
function generateBlockSummary(line: string): string {
	if (line.includes("for (")) {
		const match = line.match(/for\s*\(\s*\w+\s+\w+\s+of\s+\w+/)
		if (match) {
			return `Loop over ${match[0].split("of")[1]?.trim() || "items"}`
		}
	}
	if (line.includes("if (")) {
		return "Conditional check"
	}
	if (line.includes("while (")) {
		return "While loop"
	}
	if (line.includes("try {")) {
		return "Try block"
	}
	if (line.includes("catch (")) {
		return "Exception handling"
	}
	if (line.includes("switch (")) {
		return "Switch statement"
	}
	return ""
}

/**
 * Summarize an import block
 * @param imports - Array of ImportInfo
 * @param config - Compression configuration
 * @returns Summarized import block
 */
function summarizeImportBlock(imports: ImportInfo[], config: CompressionConfig): string {
	if (imports.length === 0) return ""

	const groupedImports: Record<string, ImportInfo[]> = {}

	for (const imp of imports) {
		const packageName = imp.path.split("/")[0] || imp.path
		if (!groupedImports[packageName]) {
			groupedImports[packageName] = []
		}
		groupedImports[packageName].push(imp)
	}

	const lines: string[] = []

	for (const [packageName, imps] of Object.entries(groupedImports)) {
		const names = imps.flatMap((i) => i.importedNames)
		if (names.length <= 3) {
			lines.push(`import { ${names.join(", ")} } from '${imps[0].path}';`)
		} else {
			lines.push(`// ${imps.length} imports from '${imps[0].path}'`)
			lines.push(`import { ${names.slice(0, 2).join(", ")}, ... } from '${imps[0].path}';`)
		}
	}

	return lines.join("\n")
}

/**
 * Summarize an export block
 * @param exports - Array of ExportInfo
 * @returns Summarized export block
 */
function summarizeExportBlock(exports: ExportInfo[]): string {
	if (exports.length === 0) return ""

	const named = exports.filter((e) => e.exportType === "named")
	const defaultExport = exports.find((e) => e.exportType === "default")

	const lines: string[] = []

	if (named.length > 0) {
		const names = named.map((e) => e.exportedName)
		lines.push(`export { ${names.join(", ")} };`)
	}

	if (defaultExport) {
		lines.push(`export default ${defaultExport.exportedName};`)
	}

	return lines.join("\n")
}

/**
 * SmartSummarizer class
 * Provides intelligent code summarization
 */
export class SmartSummarizer {
	private config: CompressionConfig
	private language: string

	/**
	 * Create a new SmartSummarizer
	 * @param config - Compression configuration
	 * @param language - Programming language
	 */
	constructor(config: CompressionConfig, language?: string) {
		this.config = config
		this.language = language || "typescript"
	}

	/**
	 * Summarize a complete file
	 * @param fileContent - File content
	 * @param filePath - Optional file path
	 * @returns Summarized file result
	 */
	summarizeFile(fileContent: string, filePath?: string): SummarizedFile {
		const language = filePath ? detectLanguage(fileContent, filePath) : this.language
		const analyzer = new CodeStructureAnalyzer(language)
		const structure = analyzeCodeStructure(fileContent, language)

		// Calculate original token estimate (rough approximation: 4 chars per token)
		const originalTokens = Math.ceil(fileContent.length / 4)

		// Summarize imports
		const preservedImports = this.config.preserveComments
			? summarizeImportBlock(structure.imports, this.config)
			: ""

		// Summarize exports
		const preservedExports = summarizeExportBlock(structure.exports)

		// Summarize classes
		const summarizedClasses = structure.classes.map((cls) => this.summarizeClass(cls))

		// Summarize functions (top-level)
		const topLevelFunctions = structure.functions.filter(
			(func) =>
				!structure.classes.some((cls) => func.startLine >= cls.startLine && func.startLine <= cls.endLine),
		)
		const summarizedFunctions = topLevelFunctions.map((func) => this.summarizeFunction(func))

		// Calculate compressed lines
		const originalLines = countLines(fileContent)
		let totalCompressed = 0

		for (const cls of summarizedClasses) {
			totalCompressed += cls.linesCompressed
		}
		for (const func of summarizedFunctions) {
			totalCompressed += func.linesCompressed
		}

		// Calculate token reduction
		const compressedContent = [
			preservedImports,
			preservedExports,
			...summarizedClasses.map((c) => c.classDefinition),
			...summarizedFunctions.map((f) => f.summary),
		].join("\n\n")

		const compressedTokens = Math.ceil(compressedContent.length / 4)
		const tokenReductionRatio = originalTokens > 0 ? (originalTokens - compressedTokens) / originalTokens : 0

		return {
			filePath: filePath || "unknown",
			language,
			preservedImports,
			preservedExports,
			summarizedClasses,
			summarizedFunctions,
			topLevelCode: this.extractTopLevelCode(fileContent),
			totalLinesCompressed: totalCompressed,
			tokenReductionRatio: Math.max(0, tokenReductionRatio),
		}
	}

	/**
	 * Summarize a function
	 * @param funcInfo - Function information
	 * @returns Summarized function
	 */
	summarizeFunction(funcInfo: FunctionInfo): SummarizedFunction {
		const originalLines = funcInfo.endLine - funcInfo.startLine + 1
		const originalBodyLines = countLines(funcInfo.body)

		let summary: string
		let linesCompressed: number
		let isEssential: boolean

		if (originalBodyLines <= 10) {
			// Small functions - keep as is
			summary = funcInfo.signature + " " + funcInfo.body
			linesCompressed = 0
			isEssential = true
		} else if (this.config.strategy === "aggressive") {
			// Aggressive: keep only signature and essential returns
			const essentialBody = summarizeFunctionBody(funcInfo.body, this.config)
			summary = funcInfo.signature + " {\n" + essentialBody + "\n}"
			linesCompressed = originalBodyLines - countLines(essentialBody)
			isEssential = countLines(essentialBody) > 0
		} else {
			// Balanced/Preservative: summarize body
			const summarizedBody = summarizeFunctionBody(funcInfo.body, this.config)
			if (summarizedBody.trim()) {
				summary = funcInfo.signature + " {\n" + summarizedBody + "\n}"
			} else {
				summary = funcInfo.signature + " { /* implementation */ }"
			}
			linesCompressed = originalBodyLines - 1
			isEssential = true
		}

		return {
			signature: funcInfo.signature,
			summary,
			linesCompressed,
			isEssential,
		}
	}

	/**
	 * Summarize a class
	 * @param classInfo - Class information
	 * @returns Summarized class
	 */
	summarizeClass(classInfo: ClassInfo): SummarizedClass {
		const originalLines = classInfo.endLine - classInfo.startLine + 1

		// Summarize methods
		const summarizedMethods = classInfo.methods.map((method) => this.summarizeFunction(method))

		// Keep essential properties
		const retainedProperties = classInfo.properties.slice(0, 5).map((prop) => {
			const modifier = prop.accessModifier || ""
			const readonly = prop.isReadonly ? "readonly " : ""
			return `    ${modifier} ${readonly}${prop.name}: ${prop.type};`
		})

		// Build class definition
		const lines: string[] = []
		lines.push(classInfo.signature + " {")

		if (this.config.preserveDocs && classInfo.docComment) {
			lines.push("  " + classInfo.docComment)
		}

		// Add properties
		if (retainedProperties.length > 0) {
			lines.push("")
			for (const prop of retainedProperties) {
				lines.push(prop)
			}
		}

		// Add summarized methods
		if (summarizedMethods.length > 0) {
			lines.push("")
			for (const method of summarizedMethods.slice(0, 10)) {
				for (const mLine of method.summary.split("\n")) {
					lines.push("  " + mLine)
				}
			}
		}

		lines.push("}")

		const classDefinition = lines.join("\n")
		const linesCompressed = originalLines - countLines(classDefinition)

		return {
			classDefinition,
			summarizedMethods,
			retainedProperties,
			linesCompressed,
		}
	}

	/**
	 * Summarize an import block
	 * @param imports - Array of ImportInfo
	 * @returns Summarized import block string
	 */
	summarizeImportBlock(imports: ImportInfo[]): string {
		return summarizeImportBlock(imports, this.config)
	}

	/**
	 * Extract top-level code (non-function, non-class code)
	 * @param content - File content
	 * @returns Top-level code
	 */
	private extractTopLevelCode(content: string): string {
		const lines = content.split("\n")
		const topLevelLines: string[] = []
		let inBlock = 0

		for (const line of lines) {
			const trimmed = line.trim()

			// Skip function and class definitions
			if (
				trimmed.startsWith("function ") ||
				trimmed.startsWith("class ") ||
				trimmed.startsWith("export ") ||
				trimmed.startsWith("import ") ||
				(trimmed.startsWith("const ") && trimmed.includes("=>")) ||
				trimmed.startsWith("def ") ||
				trimmed.startsWith("async def ")
			) {
				continue
			}

			// Track block nesting
			inBlock += (trimmed.match(/\{/g) || []).length
			inBlock -= (trimmed.match(/\}/g) || []).length

			// Only keep top-level code
			if (inBlock === 0 && !trimmed.startsWith("//") && !trimmed.startsWith("/*")) {
				topLevelLines.push(line)
			}
		}

		return topLevelLines.join("\n")
	}
}

/**
 * Create a summary of code section
 * @param section - Code section
 * @param config - Compression configuration
 * @returns Summarized section
 */
export function summarizeSection(section: string, config: CompressionConfig): string {
	const summarizer = new SmartSummarizer(config)
	const result = summarizer.summarizeFile(section)

	return [
		result.preservedImports,
		result.preservedExports,
		...result.summarizedClasses.map((c) => c.classDefinition),
		...result.summarizedFunctions.map((f) => f.summary),
	]
		.filter(Boolean)
		.join("\n\n")
}
