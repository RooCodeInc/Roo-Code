import type Anthropic from "@anthropic-ai/sdk"

/**
 * Represents a tool result from conversation messages
 */
export interface ToolResult {
	type: "tool_result"
	tool_use_id: string
	content?: string | Array<Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam>
	is_error?: boolean
}

/**
 * Result of tool result consolidation
 */
export interface ConsolidationResult {
	consolidatedContent: ToolResult[]
	metadata: {
		originalCount: number
		consolidatedCount: number
		tokensReduced: number
		reductionPercentage: number
		strategiesApplied: string[]
	}
}

/**
 * Base interface for consolidation strategies
 */
export interface ConsolidationStrategy {
	name: string
	canConsolidate(results: ToolResult[]): boolean
	consolidate(results: ToolResult[]): ToolResult[]
}

/**
 * Metadata for tracking tool results
 */
interface ToolResultWithMetadata extends ToolResult {
	messageIndex: number
	contentIndex: number
}

/**
 * ListFilesConsolidationStrategy consolidates multiple list_files operations
 * on the same or similar directories into a single result.
 */
export class ListFilesConsolidationStrategy implements ConsolidationStrategy {
	readonly name = "ListFilesConsolidation"

	canConsolidate(results: ToolResult[]): boolean {
		// Check if we have at least 2 list_files results
		const listFilesResults = results.filter((r) => this.isListFilesResult(r))
		return listFilesResults.length >= 2
	}

	consolidate(results: ToolResult[]): ToolResult[] {
		const listFilesResults = results.filter((r) => this.isListFilesResult(r))
		const otherResults = results.filter((r) => !this.isListFilesResult(r))

		if (listFilesResults.length < 2) {
			return results
		}

		// Group by directory path
		const groupedByDir = new Map<string, ToolResult[]>()
		listFilesResults.forEach((result) => {
			const dirPath = this.extractDirectoryPath(result)
			if (dirPath) {
				const existing = groupedByDir.get(dirPath) || []
				existing.push(result)
				groupedByDir.set(dirPath, existing)
			}
		})

		// Consolidate groups with multiple results
		const consolidated: ToolResult[] = []
		groupedByDir.forEach((group, dirPath) => {
			if (group.length > 1) {
				// Merge content from all results
				const allContent = group.map((r) => this.getContentText(r)).join("\n")
				const uniqueLines = [...new Set(allContent.split("\n"))].join("\n")

				consolidated.push({
					type: "tool_result",
					tool_use_id: group[0].tool_use_id,
					content: `Consolidated list_files results for ${dirPath}:\n${uniqueLines}`,
				})
			} else {
				consolidated.push(group[0])
			}
		})

		return [...consolidated, ...otherResults]
	}

	private isListFilesResult(result: ToolResult): boolean {
		const content = this.getContentText(result)
		return content.includes("list_files") || content.includes("Directory:") || /Files in .+:/i.test(content)
	}

	private extractDirectoryPath(result: ToolResult): string | null {
		const content = this.getContentText(result)
		const dirMatch = content.match(/(?:Directory|Files in|Path):\s*(.+)/i)
		return dirMatch ? dirMatch[1].trim() : null
	}

	private getContentText(result: ToolResult): string {
		if (!result.content) {
			return ""
		}
		if (typeof result.content === "string") {
			return result.content
		}
		return result.content
			.map((c) => {
				if (c.type === "text") {
					return (c as Anthropic.Messages.TextBlockParam).text
				}
				return ""
			})
			.join("")
	}
}

/**
 * SearchFilesConsolidationStrategy consolidates multiple search_files operations
 * with similar patterns into a single grouped result.
 */
export class SearchFilesConsolidationStrategy implements ConsolidationStrategy {
	readonly name = "SearchFilesConsolidation"

	canConsolidate(results: ToolResult[]): boolean {
		const searchResults = results.filter((r) => this.isSearchFilesResult(r))
		return searchResults.length >= 2
	}

	consolidate(results: ToolResult[]): ToolResult[] {
		const searchResults = results.filter((r) => this.isSearchFilesResult(r))
		const otherResults = results.filter((r) => !this.isSearchFilesResult(r))

		if (searchResults.length < 2) {
			return results
		}

		// Extract all matches and group by file
		const fileMatches = new Map<string, string[]>()
		searchResults.forEach((result) => {
			const matches = this.extractMatches(result)
			matches.forEach(([file, match]) => {
				const existing = fileMatches.get(file) || []
				existing.push(match)
				fileMatches.set(file, existing)
			})
		})

		// Build consolidated result
		let consolidatedContent = "Consolidated search_files results:\n\n"
		fileMatches.forEach((matches, file) => {
			consolidatedContent += `File: ${file}\n`
			const uniqueMatches = [...new Set(matches)]
			uniqueMatches.forEach((match) => {
				consolidatedContent += `  ${match}\n`
			})
			consolidatedContent += "\n"
		})

		const consolidated: ToolResult = {
			type: "tool_result",
			tool_use_id: searchResults[0].tool_use_id,
			content: consolidatedContent.trim(),
		}

		return [consolidated, ...otherResults]
	}

	private isSearchFilesResult(result: ToolResult): boolean {
		const content = this.getContentText(result)
		return (
			content.includes("search_files") ||
			content.includes("matches found") ||
			/Found \d+ match/i.test(content) ||
			/Match at line \d+/i.test(content)
		)
	}

	private extractMatches(result: ToolResult): Array<[string, string]> {
		const content = this.getContentText(result)
		const matches: Array<[string, string]> = []

		// Pattern 1: File: path\nMatch at line X: content
		const filePattern = /File:\s*(.+?)\n/g
		const matchPattern = /Match at line (\d+):\s*(.+)/g

		let currentFile = ""
		const lines = content.split("\n")

		for (const line of lines) {
			const fileMatch = line.match(/File:\s*(.+)/)
			if (fileMatch) {
				currentFile = fileMatch[1].trim()
			}

			const matchMatch = line.match(/Match at line (\d+):\s*(.+)/)
			if (matchMatch && currentFile) {
				matches.push([currentFile, `Line ${matchMatch[1]}: ${matchMatch[2].trim()}`])
			}
		}

		return matches
	}

	private getContentText(result: ToolResult): string {
		if (!result.content) {
			return ""
		}
		if (typeof result.content === "string") {
			return result.content
		}
		return result.content
			.map((c) => {
				if (c.type === "text") {
					return (c as Anthropic.Messages.TextBlockParam).text
				}
				return ""
			})
			.join("")
	}
}

/**
 * SequentialFileOpsStrategy consolidates sequential operations on the same file
 * into a summary of the operation sequence.
 */
export class SequentialFileOpsStrategy implements ConsolidationStrategy {
	readonly name = "SequentialFileOps"

	canConsolidate(results: ToolResult[]): boolean {
		// Need at least 2 file operations
		const fileOps = results.filter((r) => this.isFileOperation(r))
		if (fileOps.length < 2) {
			return false
		}

		// Check if we have sequential operations on same file
		const filePaths = new Map<string, number>()
		fileOps.forEach((op) => {
			const path = this.extractFilePath(op)
			if (path) {
				filePaths.set(path, (filePaths.get(path) || 0) + 1)
			}
		})

		// Return true if any file has multiple operations
		return Array.from(filePaths.values()).some((count) => count >= 2)
	}

	consolidate(results: ToolResult[]): ToolResult[] {
		const fileOps = results.filter((r) => this.isFileOperation(r))
		const otherResults = results.filter((r) => !this.isFileOperation(r))

		if (fileOps.length < 2) {
			return results
		}

		// Group by file path
		const opsByFile = new Map<string, Array<{ op: string; result: ToolResult }>>()
		fileOps.forEach((result) => {
			const path = this.extractFilePath(result)
			const opType = this.getOperationType(result)
			if (path && opType) {
				const existing = opsByFile.get(path) || []
				existing.push({ op: opType, result })
				opsByFile.set(path, existing)
			}
		})

		// Consolidate files with multiple operations
		const consolidated: ToolResult[] = []
		const processedIds = new Set<string>()

		opsByFile.forEach((ops, filePath) => {
			if (ops.length >= 2) {
				const sequence = ops.map((o) => o.op).join(" → ")
				consolidated.push({
					type: "tool_result",
					tool_use_id: ops[0].result.tool_use_id,
					content: `Sequential operations on ${filePath}: ${sequence}`,
				})
				ops.forEach((o) => processedIds.add(o.result.tool_use_id))
			} else {
				// Single operation, keep as is
				consolidated.push(ops[0].result)
				processedIds.add(ops[0].result.tool_use_id)
			}
		})

		// Add back other results that weren't processed
		fileOps.forEach((result) => {
			if (!processedIds.has(result.tool_use_id)) {
				consolidated.push(result)
			}
		})

		return [...consolidated, ...otherResults]
	}

	private isFileOperation(result: ToolResult): boolean {
		const content = this.getContentText(result)
		return (
			content.includes("read_file") ||
			content.includes("write_to_file") ||
			content.includes("apply_diff") ||
			content.includes("File:") ||
			/Successfully (read|wrote|modified)/i.test(content)
		)
	}

	private extractFilePath(result: ToolResult): string | null {
		const content = this.getContentText(result)

		// Try various patterns
		let match = content.match(/File:\s*(.+?)(?:\n|$)/)
		if (match) return match[1].trim()

		match = content.match(/(?:read|wrote|modified)\s+(.+?)(?:\n|$)/i)
		if (match) return match[1].trim()

		match = content.match(/Path:\s*(.+?)(?:\n|$)/)
		if (match) return match[1].trim()

		return null
	}

	private getOperationType(result: ToolResult): string | null {
		const content = this.getContentText(result)

		if (content.includes("read_file") || /Successfully read/i.test(content)) {
			return "read"
		}
		if (content.includes("write_to_file") || /Successfully wrote/i.test(content)) {
			return "write"
		}
		if (content.includes("apply_diff") || /Successfully (modified|applied)/i.test(content)) {
			return "modified"
		}

		return null
	}

	private getContentText(result: ToolResult): string {
		if (!result.content) {
			return ""
		}
		if (typeof result.content === "string") {
			return result.content
		}
		return result.content
			.map((c) => {
				if (c.type === "text") {
					return (c as Anthropic.Messages.TextBlockParam).text
				}
				return ""
			})
			.join("")
	}
}

/**
 * ToolResultConsolidator consolidates redundant tool results to reduce context size
 * while preserving essential information.
 */
export class ToolResultConsolidator {
	private strategies: ConsolidationStrategy[]

	constructor() {
		this.strategies = [
			new ListFilesConsolidationStrategy(),
			new SearchFilesConsolidationStrategy(),
			new SequentialFileOpsStrategy(),
		]
	}

	/**
	 * Consolidate tool results in conversation messages
	 */
	consolidate(messages: Anthropic.MessageParam[]): ConsolidationResult {
		// Extract tool results with metadata
		const toolResults = this.extractToolResults(messages)

		if (toolResults.length === 0) {
			return {
				consolidatedContent: [],
				metadata: {
					originalCount: 0,
					consolidatedCount: 0,
					tokensReduced: 0,
					reductionPercentage: 0,
					strategiesApplied: [],
				},
			}
		}

		// Track original tokens
		const tokensBeforeConsolidation = this.estimateTotalTokens(toolResults)

		// Apply each strategy
		let currentResults = toolResults.map((tr) => tr as ToolResult)
		const strategiesApplied: string[] = []

		for (const strategy of this.strategies) {
			if (strategy.canConsolidate(currentResults)) {
				currentResults = strategy.consolidate(currentResults)
				strategiesApplied.push(strategy.name)
			}
		}

		// Calculate reduction metrics
		const tokensAfterConsolidation = this.estimateTotalTokens(currentResults)
		const tokensReduced = tokensBeforeConsolidation - tokensAfterConsolidation
		const reductionPercentage =
			tokensBeforeConsolidation > 0 ? (tokensReduced / tokensBeforeConsolidation) * 100 : 0

		return {
			consolidatedContent: currentResults,
			metadata: {
				originalCount: toolResults.length,
				consolidatedCount: currentResults.length,
				tokensReduced,
				reductionPercentage,
				strategiesApplied,
			},
		}
	}

	/**
	 * Extract tool results from messages
	 */
	private extractToolResults(messages: Anthropic.MessageParam[]): ToolResultWithMetadata[] {
		const results: ToolResultWithMetadata[] = []

		messages.forEach((message, msgIndex) => {
			if (message.role !== "user") {
				return
			}

			if (typeof message.content === "string") {
				return
			}

			message.content.forEach((block, contentIndex) => {
				if (block.type === "tool_result") {
					results.push({
						...block,
						messageIndex: msgIndex,
						contentIndex,
					})
				}
			})
		})

		return results
	}

	/**
	 * Estimate total tokens for tool results
	 */
	private estimateTotalTokens(results: Array<ToolResult | ToolResultWithMetadata>): number {
		return results.reduce((sum, result) => {
			if (!result.content) {
				return sum
			}
			const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content)
			return sum + this.estimateTokens(content)
		}, 0)
	}

	/**
	 * Estimate tokens (rough: 4 chars ≈ 1 token)
	 */
	private estimateTokens(content: string): number {
		if (!content) {
			return 0
		}
		return Math.ceil(content.length / 4)
	}
}
