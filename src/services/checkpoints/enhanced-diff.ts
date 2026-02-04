import path from "path"

import { CheckpointDiff, EnhancedDiff, SemanticChange, DiffAnnotation, ChangeType, RiskLevel } from "./types"

/**
 * Language detection patterns
 */
const LANGUAGE_MAP: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".py": "python",
	".java": "java",
	".cs": "csharp",
	".cpp": "cpp",
	".c": "c",
	".go": "go",
	".rs": "rust",
	".rb": "ruby",
	".php": "php",
	".swift": "swift",
	".kt": "kotlin",
	".scala": "scala",
	".vue": "vue",
	".svelte": "svelte",
	".html": "html",
	".css": "css",
	".scss": "scss",
	".less": "less",
	".json": "json",
	".yaml": "yaml",
	".yml": "yaml",
	".xml": "xml",
	".md": "markdown",
	".sql": "sql",
	".sh": "shell",
	".bash": "shell",
	".ps1": "powershell",
}

/**
 * Critical file patterns that warrant higher risk levels
 */
const CRITICAL_FILE_PATTERNS = [
	/package\.json$/,
	/package-lock\.json$/,
	/yarn\.lock$/,
	/pnpm-lock\.yaml$/,
	/tsconfig\.json$/,
	/\.env/,
	/config\./,
	/secrets?\./,
	/auth/,
	/security/,
	/migrations?\//,
	/schema\./,
]

/**
 * Service for generating enhanced diffs with semantic analysis
 */
export class EnhancedDiffService {
	/**
	 * Enhance a basic diff with semantic analysis
	 */
	enhanceDiff(diff: CheckpointDiff): EnhancedDiff {
		const ext = path.extname(diff.paths.relative)
		const language = this.detectLanguage(ext)
		const semanticChanges = this.analyzeSemanticChanges(diff.content.before, diff.content.after, language)
		const analysis = this.analyzeChanges(diff, semanticChanges)
		const annotations = this.generateAnnotations(diff, semanticChanges)

		return {
			...diff,
			fileType: ext,
			language,
			analysis,
			semanticChanges,
			annotations,
		}
	}

	/**
	 * Enhance multiple diffs
	 */
	enhanceDiffs(diffs: CheckpointDiff[]): EnhancedDiff[] {
		return diffs.map((diff) => this.enhanceDiff(diff))
	}

	/**
	 * Detect programming language from file extension
	 */
	private detectLanguage(ext: string): string {
		return LANGUAGE_MAP[ext.toLowerCase()] || "unknown"
	}

	/**
	 * Analyze semantic changes between before and after content
	 */
	private analyzeSemanticChanges(before: string, after: string, language: string): SemanticChange[] {
		const changes: SemanticChange[] = []

		// Skip non-code files
		if (["json", "yaml", "xml", "markdown", "unknown"].includes(language)) {
			return changes
		}

		const beforeLines = before.split("\n")
		const afterLines = after.split("\n")

		// Detect function changes
		changes.push(...this.detectFunctionChanges(beforeLines, afterLines, language))

		// Detect class changes
		changes.push(...this.detectClassChanges(beforeLines, afterLines, language))

		// Detect import changes
		changes.push(...this.detectImportChanges(beforeLines, afterLines, language))

		return changes
	}

	/**
	 * Detect function additions, modifications, and deletions
	 */
	private detectFunctionChanges(beforeLines: string[], afterLines: string[], language: string): SemanticChange[] {
		const changes: SemanticChange[] = []
		const functionPattern = this.getFunctionPattern(language)

		if (!functionPattern) {
			return changes
		}

		const beforeFunctions = this.extractFunctions(beforeLines, functionPattern)
		const afterFunctions = this.extractFunctions(afterLines, functionPattern)

		// Find added functions
		for (const [name, info] of afterFunctions) {
			if (!beforeFunctions.has(name)) {
				changes.push({
					type: "function_added",
					symbolName: name,
					description: `Added function ${name}`,
					lineRange: info.lineRange,
				})
			} else {
				// Check if modified
				const beforeInfo = beforeFunctions.get(name)!
				if (beforeInfo.content !== info.content) {
					changes.push({
						type: "function_modified",
						symbolName: name,
						description: `Modified function ${name}`,
						lineRange: info.lineRange,
					})
				}
			}
		}

		// Find deleted functions
		for (const [name, info] of beforeFunctions) {
			if (!afterFunctions.has(name)) {
				changes.push({
					type: "function_deleted",
					symbolName: name,
					description: `Deleted function ${name}`,
					lineRange: info.lineRange,
				})
			}
		}

		return changes
	}

	/**
	 * Get function detection pattern for a language
	 */
	private getFunctionPattern(language: string): RegExp | null {
		switch (language) {
			case "typescript":
			case "javascript":
				return /(?:(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*[{=])/
			case "python":
				return /def\s+(\w+)\s*\(/
			case "java":
			case "csharp":
				return /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+)\s+(\w+)\s*\(/
			case "go":
				return /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/
			case "rust":
				return /fn\s+(\w+)\s*[<(]/
			default:
				return null
		}
	}

	/**
	 * Extract functions from lines of code
	 */
	private extractFunctions(
		lines: string[],
		pattern: RegExp,
	): Map<string, { content: string; lineRange: { start: number; end: number } }> {
		const functions = new Map<string, { content: string; lineRange: { start: number; end: number } }>()

		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].match(pattern)
			if (match) {
				const name = match[1] || match[2] || match[3]
				if (name) {
					// Simple heuristic: function ends at next function or end of file
					let end = i + 1
					while (end < lines.length && !lines[end].match(pattern)) {
						end++
					}
					functions.set(name, {
						content: lines.slice(i, end).join("\n"),
						lineRange: { start: i + 1, end },
					})
				}
			}
		}

		return functions
	}

	/**
	 * Detect class changes (simplified)
	 */
	private detectClassChanges(beforeLines: string[], afterLines: string[], language: string): SemanticChange[] {
		const changes: SemanticChange[] = []
		const classPattern = this.getClassPattern(language)

		if (!classPattern) {
			return changes
		}

		const beforeClasses = new Set<string>()
		const afterClasses = new Set<string>()

		for (const line of beforeLines) {
			const match = line.match(classPattern)
			if (match && match[1]) {
				beforeClasses.add(match[1])
			}
		}

		for (let i = 0; i < afterLines.length; i++) {
			const match = afterLines[i].match(classPattern)
			if (match && match[1]) {
				afterClasses.add(match[1])
				if (!beforeClasses.has(match[1])) {
					changes.push({
						type: "class_added",
						symbolName: match[1],
						description: `Added class ${match[1]}`,
						lineRange: { start: i + 1, end: i + 1 },
					})
				}
			}
		}

		for (const className of beforeClasses) {
			if (!afterClasses.has(className)) {
				changes.push({
					type: "class_deleted",
					symbolName: className,
					description: `Deleted class ${className}`,
					lineRange: { start: 0, end: 0 },
				})
			}
		}

		return changes
	}

	/**
	 * Get class detection pattern for a language
	 */
	private getClassPattern(language: string): RegExp | null {
		switch (language) {
			case "typescript":
			case "javascript":
				return /class\s+(\w+)/
			case "python":
				return /class\s+(\w+)/
			case "java":
			case "csharp":
				return /(?:public|private|protected)?\s*(?:abstract)?\s*class\s+(\w+)/
			default:
				return null
		}
	}

	/**
	 * Detect import changes
	 */
	private detectImportChanges(beforeLines: string[], afterLines: string[], language: string): SemanticChange[] {
		const changes: SemanticChange[] = []
		const importPattern = this.getImportPattern(language)

		if (!importPattern) {
			return changes
		}

		const beforeImports = new Set(beforeLines.filter((l) => importPattern.test(l)))
		const afterImports = new Set(afterLines.filter((l) => importPattern.test(l)))

		let lineNum = 0
		for (const line of afterImports) {
			if (!beforeImports.has(line)) {
				lineNum = afterLines.indexOf(line) + 1
				changes.push({
					type: "import_added",
					symbolName: line.trim(),
					description: `Added import`,
					lineRange: { start: lineNum, end: lineNum },
				})
			}
		}

		for (const line of beforeImports) {
			if (!afterImports.has(line)) {
				changes.push({
					type: "import_removed",
					symbolName: line.trim(),
					description: `Removed import`,
					lineRange: { start: 0, end: 0 },
				})
			}
		}

		return changes
	}

	/**
	 * Get import pattern for a language
	 */
	private getImportPattern(language: string): RegExp | null {
		switch (language) {
			case "typescript":
			case "javascript":
				return /^import\s+/
			case "python":
				return /^(?:import|from)\s+/
			case "java":
				return /^import\s+/
			case "go":
				return /^import\s+/
			case "rust":
				return /^use\s+/
			default:
				return null
		}
	}

	/**
	 * Analyze and categorize the overall changes
	 */
	private analyzeChanges(diff: CheckpointDiff, semanticChanges: SemanticChange[]): EnhancedDiff["analysis"] {
		const changeType = this.detectChangeType(diff, semanticChanges)
		const complexity = this.calculateComplexity(diff, semanticChanges)
		const riskLevel = this.assessRisk(diff, complexity)
		const suggestedReview = riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL

		return {
			changeType,
			complexity,
			riskLevel,
			suggestedReview,
		}
	}

	/**
	 * Detect the type of change based on content
	 */
	private detectChangeType(diff: CheckpointDiff, semanticChanges: SemanticChange[]): ChangeType {
		const fileName = diff.paths.relative.toLowerCase()

		// Test files
		if (fileName.includes("test") || fileName.includes("spec")) {
			return ChangeType.TEST
		}

		// Documentation
		if (fileName.endsWith(".md") || fileName.includes("docs")) {
			return ChangeType.DOCS
		}

		// Style files
		if (fileName.endsWith(".css") || fileName.endsWith(".scss") || fileName.endsWith(".less")) {
			return ChangeType.STYLE
		}

		// Check semantic changes
		const hasNewFunctions = semanticChanges.some((c) => c.type === "function_added" || c.type === "class_added")
		const hasOnlyModifications = semanticChanges.every(
			(c) => c.type === "function_modified" || c.type === "class_modified" || c.type === "refactor",
		)

		if (hasNewFunctions) {
			return ChangeType.FEATURE
		}

		if (hasOnlyModifications && semanticChanges.length > 0) {
			return ChangeType.REFACTOR
		}

		return ChangeType.UNKNOWN
	}

	/**
	 * Calculate complexity score (1-10)
	 */
	private calculateComplexity(diff: CheckpointDiff, semanticChanges: SemanticChange[]): number {
		let score = 1

		// Lines changed
		const beforeLines = diff.content.before.split("\n").length
		const afterLines = diff.content.after.split("\n").length
		const linesDiff = Math.abs(afterLines - beforeLines)

		if (linesDiff > 100) score += 3
		else if (linesDiff > 50) score += 2
		else if (linesDiff > 10) score += 1

		// Number of semantic changes
		if (semanticChanges.length > 10) score += 3
		else if (semanticChanges.length > 5) score += 2
		else if (semanticChanges.length > 0) score += 1

		// Function deletions are complex
		const deletions = semanticChanges.filter((c) => c.type.includes("deleted")).length
		score += Math.min(deletions, 2)

		return Math.min(score, 10)
	}

	/**
	 * Assess risk level of changes
	 */
	private assessRisk(diff: CheckpointDiff, complexity: number): RiskLevel {
		const fileName = diff.paths.relative

		// Check for critical file patterns
		const isCritical = CRITICAL_FILE_PATTERNS.some((p) => p.test(fileName))

		if (isCritical && complexity > 5) {
			return RiskLevel.CRITICAL
		}

		if (isCritical || complexity > 7) {
			return RiskLevel.HIGH
		}

		if (complexity > 4) {
			return RiskLevel.MEDIUM
		}

		return RiskLevel.LOW
	}

	/**
	 * Generate annotations for the diff
	 */
	private generateAnnotations(diff: CheckpointDiff, semanticChanges: SemanticChange[]): DiffAnnotation[] {
		const annotations: DiffAnnotation[] = []

		// Add annotations for high-risk semantic changes
		for (const change of semanticChanges) {
			if (change.type.includes("deleted")) {
				annotations.push({
					lineNumber: change.lineRange.start,
					type: "warning",
					message: `${change.symbolName} was deleted - ensure no references remain`,
				})
			}
		}

		return annotations
	}
}
