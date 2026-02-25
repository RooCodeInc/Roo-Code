/**
 * ProactiveAnalyzer — Augment-style proactive code intelligence.
 *
 * After each completed task or file edit, this analyzer:
 *   1. Detects common issues: missing tests, duplicate code, stale imports
 *   2. Suggests logical next actions based on what was just changed
 *   3. Surfaces relevant related files the user might want to update
 *   4. Shows non-blocking inline hints in the sidebar
 *
 * Unlike reactive AI (waiting for user questions), this proactively helps
 * the user stay on top of code quality — a key Augment Code feature.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import EventEmitter from "events"

export interface ProactiveSuggestion {
	id: string
	type: "test-missing" | "duplicate-code" | "stale-import" | "related-file" | "next-action" | "convention"
	priority: "high" | "medium" | "low"
	title: string
	description: string
	filePath?: string
	lineNumber?: number
	actionLabel?: string
	action?: () => void
}

export interface AnalysisResult {
	suggestions: ProactiveSuggestion[]
	analyzedFiles: string[]
	timestamp: number
}

const TEST_FILE_PATTERNS = [
	(f: string) => f.replace(/\.(ts|js|tsx|jsx)$/, ".test.$1"),
	(f: string) => f.replace(/\.(ts|js|tsx|jsx)$/, ".spec.$1"),
	(f: string) => f.replace(/src\//, "src/__tests__/").replace(/\.(ts|js|tsx|jsx)$/, ".test.$1"),
	(f: string) => f.replace(/src\//, "tests/").replace(/\.(ts|js|tsx|jsx)$/, ".test.$1"),
]

const NEXT_ACTION_RULES: Array<{
	pattern: RegExp
	suggestions: Array<Omit<ProactiveSuggestion, "id">>
}> = [
	{
		// After editing a service file, suggest checking controllers/routes
		pattern: /\/(services?|service)\//i,
		suggestions: [
			{
				type: "next-action",
				priority: "medium",
				title: "Check related controllers/routes",
				description: "You edited a service file. Consider checking if any controllers or routes need updating.",
				actionLabel: "Search for usages",
			},
		],
	},
	{
		// After editing API handlers, suggest updating types
		pattern: /\/(api|routes?|handlers?)\//i,
		suggestions: [
			{
				type: "next-action",
				priority: "medium",
				title: "Update API types",
				description: "You edited an API handler. Check if request/response types need updating.",
				actionLabel: "Show types",
			},
		],
	},
	{
		// After editing config files, suggest restarting/reloading
		pattern: /\/(config|settings?|env)\//i,
		suggestions: [
			{
				type: "next-action",
				priority: "high",
				title: "Configuration changed",
				description: "Config files were modified. Ensure all consumers of this config are updated.",
				actionLabel: "Find consumers",
			},
		],
	},
	{
		// After editing database models/schemas
		pattern: /\/(models?|schema|migrations?)\//i,
		suggestions: [
			{
				type: "next-action",
				priority: "high",
				title: "Run database migration",
				description: "Database schema changed. Consider creating a migration if you haven't already.",
				actionLabel: "Check migrations",
			},
		],
	},
]

export class ProactiveAnalyzer extends EventEmitter {
	private static instances = new Map<string, ProactiveAnalyzer>()
	private lastAnalysis: AnalysisResult | null = null
	private analysisQueue: string[] = []
	private isAnalyzing = false
	private disposables: vscode.Disposable[] = []

	static getInstance(workspacePath: string): ProactiveAnalyzer {
		if (!this.instances.has(workspacePath)) {
			this.instances.set(workspacePath, new ProactiveAnalyzer(workspacePath))
		}
		return this.instances.get(workspacePath)!
	}

	static disposeAll(): void {
		for (const inst of this.instances.values()) {
			inst.dispose()
		}
		this.instances.clear()
	}

	private constructor(private readonly workspacePath: string) {
		super()
	}

	/**
	 * Analyze files that were just changed and generate suggestions.
	 * Call this after each task completion or file edit.
	 */
	async analyzeChanges(changedFiles: string[]): Promise<AnalysisResult> {
		const suggestions: ProactiveSuggestion[] = []
		const analyzed: string[] = []

		for (const filePath of changedFiles) {
			if (!filePath.startsWith(this.workspacePath)) continue
			analyzed.push(filePath)

			// Check for missing tests
			const testSuggestion = await this.checkMissingTests(filePath)
			if (testSuggestion) suggestions.push(testSuggestion)

			// Check for next actions based on file path patterns
			const nextActions = this.generateNextActions(filePath)
			suggestions.push(...nextActions)

			// Check for related files the user might want to update
			const relatedFiles = await this.findRelatedFiles(filePath)
			suggestions.push(...relatedFiles)
		}

		// Deduplicate by title
		const seen = new Set<string>()
		const unique = suggestions.filter((s) => {
			if (seen.has(s.title)) return false
			seen.add(s.title)
			return true
		})

		// Sort by priority
		const priorityOrder = { high: 0, medium: 1, low: 2 }
		unique.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

		this.lastAnalysis = {
			suggestions: unique.slice(0, 5), // cap at 5 suggestions
			analyzedFiles: analyzed,
			timestamp: Date.now(),
		}

		this.emit("analysis", this.lastAnalysis)
		return this.lastAnalysis
	}

	/**
	 * Get the last analysis result.
	 */
	getLastAnalysis(): AnalysisResult | null {
		return this.lastAnalysis
	}

	/**
	 * Format suggestions as a string for injection into the AI response.
	 */
	formatSuggestionsForPrompt(result: AnalysisResult): string {
		if (result.suggestions.length === 0) return ""

		const lines = ["\n\n---\n### Joe AI Proactive Suggestions\n"]
		for (const s of result.suggestions) {
			const emoji = s.priority === "high" ? "⚠️" : s.priority === "medium" ? "💡" : "ℹ️"
			lines.push(`${emoji} **${s.title}**`)
			lines.push(`   ${s.description}`)
			if (s.filePath) {
				lines.push(`   File: \`${path.relative(this.workspacePath, s.filePath)}\``)
			}
		}
		lines.push("---\n")
		return lines.join("\n")
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose()
		}
		this.disposables = []
	}

	// --- Private Methods ---

	private async checkMissingTests(filePath: string): Promise<ProactiveSuggestion | null> {
		// Only check source files (not test files themselves)
		if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)) return null
		if (!PRIORITY_CODE_EXTENSIONS.has(path.extname(filePath))) return null

		// Check if any test file exists for this source file
		for (const getTestPath of TEST_FILE_PATTERNS) {
			const testPath = getTestPath(filePath)
			try {
				await fs.access(testPath)
				return null // test file exists
			} catch {
				// doesn't exist, try next pattern
			}
		}

		return {
			id: `missing-test-${filePath}`,
			type: "test-missing",
			priority: "medium",
			title: "Missing test file",
			description: `No test file found for \`${path.basename(filePath)}\`. Consider adding tests to improve coverage.`,
			filePath,
			actionLabel: "Create test file",
		}
	}

	private generateNextActions(filePath: string): ProactiveSuggestion[] {
		const suggestions: ProactiveSuggestion[] = []

		for (const rule of NEXT_ACTION_RULES) {
			if (rule.pattern.test(filePath)) {
				for (const s of rule.suggestions) {
					suggestions.push({
						id: `next-action-${filePath}-${s.type}`,
						...s,
					})
				}
			}
		}

		return suggestions
	}

	private async findRelatedFiles(filePath: string): Promise<ProactiveSuggestion[]> {
		const suggestions: ProactiveSuggestion[] = []
		const basename = path.basename(filePath, path.extname(filePath))
		const dir = path.dirname(filePath)

		// Look for index files that might export this module
		const indexFiles = [
			path.join(dir, "index.ts"),
			path.join(dir, "index.js"),
			path.join(dir, "../index.ts"),
		]

		for (const indexFile of indexFiles) {
			try {
				const content = await fs.readFile(indexFile, "utf-8")
				if (content.includes(basename) && indexFile !== filePath) {
					suggestions.push({
						id: `related-index-${indexFile}`,
						type: "related-file",
						priority: "low",
						title: `Related: ${path.relative(this.workspacePath, indexFile)}`,
						description: `This index file exports \`${basename}\`. Check if the export needs updating.`,
						filePath: indexFile,
						actionLabel: "Open file",
					})
				}
			} catch {
				// file doesn't exist
			}
		}

		return suggestions.slice(0, 2) // max 2 related file suggestions
	}
}

const PRIORITY_CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"])
