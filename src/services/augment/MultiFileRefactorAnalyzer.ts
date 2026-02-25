/**
 * MultiFileRefactorAnalyzer — Augment-style cross-file impact analysis.
 *
 * Before applying a refactor, this analyzer:
 *   1. Finds all files that import/use the target symbol
 *   2. Detects duplicate code patterns across the codebase
 *   3. Generates a change impact map showing what will break
 *   4. Provides a safe, ordered sequence for applying changes
 *
 * This gives Joe AI the ability to do codebase-wide refactors safely
 * rather than blindly editing one file at a time.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { SmartContextSelector, ContextFile } from "./SmartContextSelector"

export interface SymbolUsage {
	filePath: string
	lineNumber: number
	lineContent: string
	usageType: "import" | "call" | "reference" | "extend" | "implement"
}

export interface ImpactMap {
	targetSymbol: string
	targetFile: string
	directUsages: SymbolUsage[]
	indirectFiles: string[] // files that import files that use the symbol
	totalFilesAffected: number
	riskLevel: "low" | "medium" | "high"
	changeOrder: string[] // recommended order to apply changes
	summary: string
}

export interface DuplicateBlock {
	content: string
	occurrences: Array<{ filePath: string; lineStart: number; lineEnd: number }>
	similarityScore: number
	refactorSuggestion: string
}

const MAX_FILES_TO_SCAN = 500
const MIN_DUPLICATE_LINES = 5

export class MultiFileRefactorAnalyzer {
	private static instances = new Map<string, MultiFileRefactorAnalyzer>()

	static getInstance(workspacePath: string): MultiFileRefactorAnalyzer {
		if (!this.instances.has(workspacePath)) {
			this.instances.set(workspacePath, new MultiFileRefactorAnalyzer(workspacePath))
		}
		return this.instances.get(workspacePath)!
	}

	static disposeAll(): void {
		this.instances.clear()
	}

	private constructor(private readonly workspacePath: string) {}

	/**
	 * Analyze the impact of renaming or changing a symbol across the codebase.
	 * Call this before any rename/refactor operation.
	 */
	async analyzeSymbolImpact(symbolName: string, sourceFilePath: string): Promise<ImpactMap> {
		const usages: SymbolUsage[] = []
		const scannedFiles = await this.getCodeFiles()

		for (const filePath of scannedFiles) {
			if (filePath === sourceFilePath) continue

			try {
				const content = await fs.readFile(filePath, "utf-8")
				const lines = content.split("\n")

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i]
					if (!line.includes(symbolName)) continue

					const usageType = this.detectUsageType(line, symbolName)
					if (usageType) {
						usages.push({
							filePath,
							lineNumber: i + 1,
							lineContent: line.trim(),
							usageType,
						})
					}
				}
			} catch {
				// skip unreadable files
			}
		}

		// Find indirect files (files that import files that have usages)
		const directFiles = new Set(usages.map((u) => u.filePath))
		const indirectFiles: string[] = []

		for (const filePath of scannedFiles) {
			if (directFiles.has(filePath) || filePath === sourceFilePath) continue

			try {
				const content = await fs.readFile(filePath, "utf-8")
				for (const directFile of directFiles) {
					const relativePath = path.relative(path.dirname(filePath), directFile).replace(/\\/g, "/")
					const basename = path.basename(directFile, path.extname(directFile))
					if (content.includes(relativePath) || content.includes(basename)) {
						indirectFiles.push(filePath)
						break
					}
				}
			} catch {
				// skip
			}
		}

		const totalAffected = directFiles.size + indirectFiles.length + 1 // +1 for source file

		// Determine risk level
		let riskLevel: "low" | "medium" | "high"
		if (totalAffected <= 3) {
			riskLevel = "low"
		} else if (totalAffected <= 10) {
			riskLevel = "medium"
		} else {
			riskLevel = "high"
		}

		// Recommended change order: source file first, then direct usages, then indirect
		const changeOrder = [
			sourceFilePath,
			...Array.from(directFiles),
			...indirectFiles,
		].map((f) => path.relative(this.workspacePath, f))

		const summary = this.buildImpactSummary(symbolName, usages, indirectFiles, riskLevel)

		return {
			targetSymbol: symbolName,
			targetFile: sourceFilePath,
			directUsages: usages,
			indirectFiles,
			totalFilesAffected: totalAffected,
			riskLevel,
			changeOrder,
			summary,
		}
	}

	/**
	 * Find duplicate code blocks across the codebase.
	 */
	async findDuplicates(minLines = MIN_DUPLICATE_LINES): Promise<DuplicateBlock[]> {
		const files = await this.getCodeFiles()
		const blockMap = new Map<string, Array<{ filePath: string; lineStart: number; lineEnd: number }>>()

		for (const filePath of files) {
			try {
				const content = await fs.readFile(filePath, "utf-8")
				const lines = content.split("\n")

				// Slide a window of `minLines` over the file
				for (let i = 0; i <= lines.length - minLines; i++) {
					const block = lines
						.slice(i, i + minLines)
						.map((l) => l.trim())
						.filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("*"))
						.join("\n")

					if (block.length < 100) continue // too short to be meaningful

					const existing = blockMap.get(block) ?? []
					existing.push({ filePath, lineStart: i + 1, lineEnd: i + minLines })
					blockMap.set(block, existing)
				}
			} catch {
				// skip
			}
		}

		const duplicates: DuplicateBlock[] = []
		for (const [content, occurrences] of blockMap.entries()) {
			if (occurrences.length < 2) continue

			duplicates.push({
				content,
				occurrences,
				similarityScore: 1.0, // exact match
				refactorSuggestion: `Extract this ${occurrences.length}-occurrence block into a shared utility function`,
			})
		}

		// Sort by number of occurrences (most duplicated first)
		return duplicates.sort((a, b) => b.occurrences.length - a.occurrences.length).slice(0, 10)
	}

	/**
	 * Format an impact map as a prompt string for Joe AI.
	 */
	formatImpactForPrompt(impact: ImpactMap): string {
		const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" }[impact.riskLevel]
		const lines = [
			`\n\n---\n### Joe AI Refactor Impact Analysis for \`${impact.targetSymbol}\`\n`,
			`${riskEmoji} **Risk Level**: ${impact.riskLevel.toUpperCase()} (${impact.totalFilesAffected} files affected)\n`,
			`**${impact.summary}**\n`,
		]

		if (impact.directUsages.length > 0) {
			lines.push(`\n**Direct Usages (${impact.directUsages.length}):**`)
			const grouped = new Map<string, SymbolUsage[]>()
			for (const u of impact.directUsages) {
				const rel = path.relative(this.workspacePath, u.filePath)
				const existing = grouped.get(rel) ?? []
				existing.push(u)
				grouped.set(rel, existing)
			}
			for (const [file, usages] of grouped.entries()) {
				lines.push(`- \`${file}\`: lines ${usages.map((u) => u.lineNumber).join(", ")}`)
			}
		}

		if (impact.indirectFiles.length > 0) {
			lines.push(`\n**Indirectly Affected (${impact.indirectFiles.length}):**`)
			for (const f of impact.indirectFiles.slice(0, 5)) {
				lines.push(`- \`${path.relative(this.workspacePath, f)}\``)
			}
			if (impact.indirectFiles.length > 5) {
				lines.push(`- ... and ${impact.indirectFiles.length - 5} more`)
			}
		}

		lines.push(`\n**Recommended Change Order:**`)
		for (let i = 0; i < Math.min(impact.changeOrder.length, 10); i++) {
			lines.push(`${i + 1}. \`${impact.changeOrder[i]}\``)
		}

		lines.push("\n---\n")
		return lines.join("\n")
	}

	// --- Private Methods ---

	private async getCodeFiles(): Promise<string[]> {
		const files: string[] = []
		await this.walkDir(this.workspacePath, files)
		return files.slice(0, MAX_FILES_TO_SCAN)
	}

	private async walkDir(dirPath: string, results: string[]): Promise<void> {
		const IGNORED = new Set(["node_modules", ".git", "dist", "build", "out", ".next", "__pycache__"])
		const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".cs"])

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			for (const entry of entries) {
				if (IGNORED.has(entry.name)) continue
				const fullPath = path.join(dirPath, entry.name)
				if (entry.isDirectory()) {
					await this.walkDir(fullPath, results)
				} else if (CODE_EXTS.has(path.extname(entry.name))) {
					results.push(fullPath)
				}
			}
		} catch {
			// skip unreadable dirs
		}
	}

	private detectUsageType(
		line: string,
		symbol: string,
	): SymbolUsage["usageType"] | null {
		const trimmed = line.trim()
		if (trimmed.includes(`import`) && trimmed.includes(symbol)) return "import"
		if (trimmed.includes(`extends ${symbol}`) || trimmed.includes(`extends ${symbol}<`)) return "extend"
		if (trimmed.includes(`implements ${symbol}`)) return "implement"
		if (new RegExp(`\\b${symbol}\\s*\\(`).test(trimmed)) return "call"
		if (new RegExp(`\\b${symbol}\\b`).test(trimmed)) return "reference"
		return null
	}

	private buildImpactSummary(
		symbol: string,
		usages: SymbolUsage[],
		indirectFiles: string[],
		riskLevel: string,
	): string {
		const importCount = usages.filter((u) => u.usageType === "import").length
		const callCount = usages.filter((u) => u.usageType === "call").length
		const parts: string[] = []
		if (importCount > 0) parts.push(`imported in ${importCount} file${importCount > 1 ? "s" : ""}`)
		if (callCount > 0) parts.push(`called ${callCount} time${callCount > 1 ? "s" : ""}`)
		if (indirectFiles.length > 0) parts.push(`${indirectFiles.length} indirect dependencies`)
		return `\`${symbol}\` is ${parts.join(", ")}. ${riskLevel === "high" ? "Proceed carefully — high impact change." : riskLevel === "medium" ? "Moderate impact — review all affected files." : "Low impact — safe to proceed."}`
	}
}
