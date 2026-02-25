/**
 * SmartContextSelector — Augment-style RAG (Retrieval-Augmented Generation) engine.
 *
 * Before every API call, this automatically:
 *   1. Semantically searches the codebase index for files relevant to the user's query
 *   2. Ranks results by relevance score + recency + edit frequency
 *   3. Injects the top-N files as context into the prompt
 *   4. Stays within a configurable token budget
 *
 * This is the core of what makes Augment Code feel "context-aware" —
 * Joe AI will automatically know about the relevant parts of your codebase.
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { CodeIndexManager } from "../code-index/manager"
import { VectorStoreSearchResult } from "../code-index/interfaces"
import { MemoryManager } from "./MemoryManager"

export interface ContextFile {
	filePath: string
	content: string
	relevanceScore: number
	reason: string // why this file was selected
	lineStart?: number
	lineEnd?: number
}

export interface SmartContextResult {
	files: ContextFile[]
	totalTokensEstimated: number
	query: string
	selectionReason: string
}

const MAX_FILES_IN_CONTEXT = 8
const MAX_TOKENS_PER_FILE = 2000 // ~8000 chars
const MAX_TOTAL_CONTEXT_TOKENS = 12000
const CHARS_PER_TOKEN = 4

export class SmartContextSelector {
	private static instances = new Map<string, SmartContextSelector>()

	static getInstance(
		context: vscode.ExtensionContext,
		workspacePath: string,
		memoryManager?: MemoryManager,
	): SmartContextSelector {
		if (!this.instances.has(workspacePath)) {
			this.instances.set(
				workspacePath,
				new SmartContextSelector(context, workspacePath, memoryManager),
			)
		}
		return this.instances.get(workspacePath)!
	}

	static disposeAll(): void {
		this.instances.clear()
	}

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspacePath: string,
		private readonly memoryManager?: MemoryManager,
	) {}

	/**
	 * Main entry point: given a user query, find and return the most relevant
	 * files from the codebase to inject as context.
	 */
	async selectContext(query: string, activeFilePath?: string): Promise<SmartContextResult> {
		const selected: ContextFile[] = []
		let totalTokens = 0
		const reasons: string[] = []

		// 1. Always include active file (highest priority)
		if (activeFilePath && activeFilePath.startsWith(this.workspacePath)) {
			const activeContext = await this.loadFileContext(activeFilePath, 1.0, "Currently open file")
			if (activeContext) {
				selected.push(activeContext)
				totalTokens += activeContext.content.length / CHARS_PER_TOKEN
				reasons.push("active file")
			}
		}

		// 2. Semantic search using code index
		const codeIndexManager = CodeIndexManager.getInstance(this.context, this.workspacePath)
		if (codeIndexManager?.isFeatureEnabled && codeIndexManager?.isFeatureConfigured) {
			try {
				// searchIndex(query, directoryPrefix?) — no limit param, limit is set in config
			const searchResults = await codeIndexManager.searchIndex(query)
				const rankedResults = this.rankResults(searchResults, activeFilePath)

				for (const result of rankedResults) {
					if (selected.length >= MAX_FILES_IN_CONTEXT) break
					if (totalTokens >= MAX_TOTAL_CONTEXT_TOKENS) break
					if (selected.some((f) => f.filePath === result.filePath)) continue

					const ctx = await this.loadFileContext(
						result.filePath,
						result.score,
						`Semantic match (score: ${result.score.toFixed(2)})`,
						result.startLine,
						result.endLine,
					)
					if (ctx) {
						const tokensForFile = ctx.content.length / CHARS_PER_TOKEN
						if (totalTokens + tokensForFile <= MAX_TOTAL_CONTEXT_TOKENS) {
							selected.push(ctx)
							totalTokens += tokensForFile
						}
					}
				}
				if (searchResults.length > 0) {
					reasons.push(`${Math.min(searchResults.length, MAX_FILES_IN_CONTEXT)} semantic matches`)
				}
			} catch (err) {
				// Index not ready — fall back to memory-based selection
				console.warn("[SmartContextSelector] Code index search failed:", err)
			}
		}

		// 3. Supplement with frequently edited files from memory
		if (this.memoryManager && selected.length < MAX_FILES_IN_CONTEXT) {
			const frequentFiles = this.memoryManager.getFrequentlyEditedFiles(10)
			for (const fp of frequentFiles) {
				if (selected.length >= MAX_FILES_IN_CONTEXT) break
				if (selected.some((f) => f.filePath === fp)) continue
				if (totalTokens >= MAX_TOTAL_CONTEXT_TOKENS) break

				const ctx = await this.loadFileContext(fp, 0.5, "Frequently edited file")
				if (ctx) {
					const tokensForFile = ctx.content.length / CHARS_PER_TOKEN
					if (totalTokens + tokensForFile <= MAX_TOTAL_CONTEXT_TOKENS) {
						selected.push(ctx)
						totalTokens += tokensForFile
					}
				}
			}
			if (frequentFiles.length > 0) {
				reasons.push("memory-ranked files")
			}
		}

		return {
			files: selected,
			totalTokensEstimated: Math.round(totalTokens),
			query,
			selectionReason: reasons.join(", ") || "no relevant context found",
		}
	}

	/**
	 * Format selected context as a string block for injection into prompts.
	 */
	formatContextForPrompt(result: SmartContextResult): string {
		if (result.files.length === 0) {
			return ""
		}

		const parts: string[] = [
			`\n\n---\n### Joe AI Auto-Context (${result.files.length} files, ~${result.totalTokensEstimated} tokens)\n`,
			`*Selected based on: ${result.selectionReason}*\n`,
		]

		for (const file of result.files) {
			const relPath = path.relative(this.workspacePath, file.filePath)
			const lineInfo = file.lineStart ? ` (lines ${file.lineStart}-${file.lineEnd})` : ""
			parts.push(`\n**\`${relPath}\`**${lineInfo} — *${file.reason}*`)
			parts.push("```")
			parts.push(file.content)
			parts.push("```")
		}

		parts.push("\n---\n")
		return parts.join("\n")
	}

	// --- Private Methods ---

	private rankResults(
		results: VectorStoreSearchResult[],
		activeFilePath?: string,
	): Array<VectorStoreSearchResult & { filePath: string; startLine?: number; endLine?: number }> {
		return results
			.map((r) => {
				// VectorStoreSearchResult stores filePath/line info in payload
				const filePath = r.payload?.filePath ?? ""
				const startLine = r.payload?.startLine as number | undefined
				const endLine = r.payload?.endLine as number | undefined
				let score = r.score ?? 0

				// Boost files that are related to active file's directory
				if (activeFilePath && filePath) {
					const activeDir = path.dirname(activeFilePath)
					if (filePath.startsWith(activeDir)) {
						score *= 1.3
					}
				}

				// Boost memory-known frequently edited files
				if (this.memoryManager && filePath) {
					const fm = this.memoryManager.getFileMemory(filePath)
					if (fm) {
						// Recency boost: files edited in last 24h
						const ageHours = (Date.now() - fm.lastEditedAt) / (1000 * 60 * 60)
						if (ageHours < 24) {
							score *= 1.2
						}
						// Edit frequency boost
						score *= 1 + Math.min(fm.editCount * 0.05, 0.3)
					}
				}

				return { ...r, filePath, startLine, endLine, score }
			})
			.sort((a, b) => b.score - a.score)
	}

	private async loadFileContext(
		filePath: string,
		score: number,
		reason: string,
		lineStart?: number,
		lineEnd?: number,
	): Promise<ContextFile | null> {
		try {
			const raw = await fs.readFile(filePath, "utf-8")
			let content: string

			if (lineStart !== undefined && lineEnd !== undefined) {
				// Extract relevant lines only
				const lines = raw.split("\n")
				const start = Math.max(0, lineStart - 5) // 5 lines of padding
				const end = Math.min(lines.length, (lineEnd ?? lineStart) + 5)
				content = lines.slice(start, end).join("\n")
			} else {
				// Truncate to max tokens
				const maxChars = MAX_TOKENS_PER_FILE * CHARS_PER_TOKEN
				content = raw.length > maxChars ? raw.slice(0, maxChars) + "\n... (truncated)" : raw
			}

			return {
				filePath,
				content,
				relevanceScore: score,
				reason,
				lineStart,
				lineEnd,
			}
		} catch {
			return null
		}
	}
}
