/**
 * Context Compressor V2
 *
 * Advanced context compression for context-engine BuiltContext.
 * Provides multi-stage compression with progressive reduction of content
 * while preserving essential information.
 */

import type { BuiltContext, ContextItem, ContextType } from "./context-builder"
import { CodeStructureAnalyzer, SmartSummarizer } from "../context-compression"
import type { CompressionConfig } from "../context-compression/interfaces"

/**
 * Compression options for ContextCompressorV2
 */
export interface CompressionOptions {
	/** Minimum priority to keep (1-10) */
	minPriority?: number
	/** Maximum items to keep per type */
	maxItemsPerType?: number
	/** Summarize code blocks larger than this many tokens */
	summarizeThreshold?: number
	/** Preserve critical items regardless of compression */
	preserveCritical?: boolean
	/** Critical context types to always preserve */
	criticalTypes?: ContextType[]
}

/**
 * Compression result with metadata
 */
export interface CompressedContextResult {
	/** Compressed context */
	context: BuiltContext
	/** Original token count */
	originalTokens: number
	/** Compressed token count */
	compressedTokens: number
	/** Compression ratio (0-1) */
	compressionRatio: number
	/** Stage at which compression completed */
	stage: 0 | 1 | 2 | 3 | 4
	/** Items removed per stage */
	itemsRemoved: {
		stage1: number
		stage2: number
		stage3: number
		stage4: number
	}
	/** Warnings generated during compression */
	warnings: string[]
}

/**
 * Items removed tracking
 */
interface ItemsRemoved {
	stage1: number
	stage2: number
	stage3: number
	stage4: number
}

/**
 * ContextCompressorV2 - Advanced context compression for BuiltContext
 *
 * Provides progressive compression with multiple stages:
 * - Stage 0: No compression needed
 * - Stage 1: Remove low-priority items
 * - Stage 2: Summarize code blocks
 * - Stage 3: Extract signatures only
 * - Stage 4: Aggressive truncation
 */
export class ContextCompressorV2 {
	private summarizer: SmartSummarizer
	private structureAnalyzer: CodeStructureAnalyzer

	/**
	 * Create a new ContextCompressorV2
	 */
	constructor() {
		const config: CompressionConfig = {
			enabled: true,
			strategy: "balanced",
			preserveComments: true,
			preserveDocs: true,
			minRetentionRatio: 0.3,
		}
		this.summarizer = new SmartSummarizer(config)
		this.structureAnalyzer = new CodeStructureAnalyzer()
	}

	/**
	 * Estimate token count from content
	 */
	private estimateTokens(content: string): number {
		if (!content) return 0
		return Math.ceil(content.length / 4)
	}

	/**
	 * Estimate tokens for a context item
	 */
	private estimateItemTokens(item: ContextItem): number {
		return this.estimateTokens(item.content)
	}

	/**
	 * Estimate total tokens for context items
	 */
	private estimateContextTokens(items: ContextItem[]): number {
		return items.reduce((total, item) => total + this.estimateItemTokens(item), 0)
	}

	/**
	 * Main compression method - compress BuiltContext to fit within maxTokens
	 */
	async compress(
		context: BuiltContext,
		maxTokens: number,
		options: CompressionOptions = {},
	): Promise<CompressedContextResult> {
		const opts = this.getDefaultOptions(options)
		const originalTokens = context.totalTokens

		// Stage 0: Check if compression is needed
		if (originalTokens <= maxTokens) {
			return this.createResult(
				context,
				originalTokens,
				originalTokens,
				0,
				{ stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
				[],
			)
		}

		let currentContext = { ...context, items: [...context.items] }
		let currentTokens = originalTokens
		const itemsRemoved: ItemsRemoved = { stage1: 0, stage2: 0, stage3: 0, stage4: 0 }
		const warnings: string[] = []

		// Stage 1: Remove low-priority items
		const stage1Result = this.stage1RemoveLowPriority(currentContext, currentTokens, maxTokens, opts)
		currentContext = stage1Result.context
		currentTokens = stage1Result.tokens
		itemsRemoved.stage1 = stage1Result.removed
		warnings.push(...stage1Result.warnings)

		if (currentTokens <= maxTokens) {
			return this.createResult(currentContext, originalTokens, currentTokens, 1, itemsRemoved, warnings)
		}

		// Stage 2: Summarize code blocks
		const stage2Result = await this.stage2SummarizeCode(currentContext, currentTokens, maxTokens, opts)
		currentContext = stage2Result.context
		currentTokens = stage2Result.tokens
		itemsRemoved.stage2 = stage2Result.removed
		warnings.push(...stage2Result.warnings)

		if (currentTokens <= maxTokens) {
			return this.createResult(currentContext, originalTokens, currentTokens, 2, itemsRemoved, warnings)
		}

		// Stage 3: Extract signatures only
		const stage3Result = this.stage3ExtractSignatures(currentContext, currentTokens, maxTokens, opts)
		currentContext = stage3Result.context
		currentTokens = stage3Result.tokens
		itemsRemoved.stage3 = stage3Result.removed
		warnings.push(...stage3Result.warnings)

		if (currentTokens <= maxTokens) {
			return this.createResult(currentContext, originalTokens, currentTokens, 3, itemsRemoved, warnings)
		}

		// Stage 4: Aggressive truncation
		const stage4Result = this.stage4AggressiveTruncate(currentContext, currentTokens, maxTokens, opts)
		currentContext = stage4Result.context
		currentTokens = stage4Result.tokens
		itemsRemoved.stage4 = stage4Result.removed
		warnings.push(...stage4Result.warnings)

		return this.createResult(currentContext, originalTokens, currentTokens, 4, itemsRemoved, warnings)
	}

	/**
	 * Get default compression options
	 */
	private getDefaultOptions(options: CompressionOptions): Required<CompressionOptions> {
		return {
			minPriority: options.minPriority ?? 3,
			maxItemsPerType: options.maxItemsPerType ?? 5,
			summarizeThreshold: options.summarizeThreshold ?? 500,
			preserveCritical: options.preserveCritical ?? true,
			criticalTypes: (options.criticalTypes ?? ["code"]) as ContextType[],
		}
	}

	/**
	 * Create a compression result
	 */
	private createResult(
		context: BuiltContext,
		originalTokens: number,
		compressedTokens: number,
		stage: 0 | 1 | 2 | 3 | 4,
		itemsRemoved: ItemsRemoved,
		warnings: string[],
	): CompressedContextResult {
		const compressionRatio = originalTokens > 0 ? 1 - compressedTokens / originalTokens : 0

		return {
			context: {
				...context,
				totalTokens: compressedTokens,
				metadata: {
					...context.metadata,
					compressionApplied: originalTokens > compressedTokens,
					originalTokens,
				},
			},
			originalTokens,
			compressedTokens,
			compressionRatio: Math.max(0, compressionRatio),
			stage,
			itemsRemoved,
			warnings,
		}
	}

	/**
	 * Stage 1: Remove low-priority items
	 */
	private stage1RemoveLowPriority(
		context: BuiltContext,
		currentTokens: number,
		maxTokens: number,
		opts: Required<CompressionOptions>,
	): { context: BuiltContext; tokens: number; removed: number; warnings: string[] } {
		const warnings: string[] = []
		const criticalTypes = new Set(opts.criticalTypes)

		// Sort items by priority (ascending) to remove lowest priority first
		const sortedItems = [...context.items].sort((a, b) => a.priority - b.priority)

		const keptItems: ContextItem[] = []
		const tokensByType: Record<string, number> = {}
		const files = new Set<string>()

		for (const item of sortedItems) {
			const itemTokens = this.estimateItemTokens(item)

			// Always keep critical types
			if (criticalTypes.has(item.type) && item.priority >= opts.minPriority) {
				keptItems.push(item)
				tokensByType[item.type] = (tokensByType[item.type] || 0) + itemTokens
				if (item.source) files.add(item.source)
				continue
			}

			// Keep if priority is above threshold
			if (item.priority >= opts.minPriority) {
				// Check max items per type
				const currentTypeCount = keptItems.filter((i) => i.type === item.type).length
				if (currentTypeCount < opts.maxItemsPerType) {
					keptItems.push(item)
					tokensByType[item.type] = (tokensByType[item.type] || 0) + itemTokens
					if (item.source) files.add(item.source)
				}
			}
		}

		// Re-sort kept items by priority descending
		keptItems.sort((a, b) => b.priority - a.priority)

		const newTokens = this.estimateContextTokens(keptItems)
		const removed = context.items.length - keptItems.length

		if (removed > 0) {
			warnings.push(`Stage 1: Removed ${removed} low-priority items`)
		}

		return {
			context: {
				...context,
				items: keptItems,
				totalTokens: newTokens,
				tokenBreakdown: tokensByType as Record<ContextType, number>,
				files: Array.from(files),
			},
			tokens: newTokens,
			removed,
			warnings,
		}
	}

	/**
	 * Stage 2: Summarize code blocks
	 */
	private async stage2SummarizeCode(
		context: BuiltContext,
		currentTokens: number,
		maxTokens: number,
		opts: Required<CompressionOptions>,
	): Promise<{ context: BuiltContext; tokens: number; removed: number; warnings: string[] }> {
		const warnings: string[] = []
		const newItems: ContextItem[] = []
		let totalRemovedTokens = 0
		let summarizedCount = 0

		for (const item of context.items) {
			if (item.type === "code") {
				const itemTokens = this.estimateItemTokens(item)

				if (itemTokens > opts.summarizeThreshold) {
					try {
						const summary = await this.summarizeCode(item.content)
						const summaryTokens = this.estimateTokens(summary)
						const removedTokens = itemTokens - summaryTokens

						// Only summarize if it saves tokens
						if (removedTokens > 0) {
							newItems.push({
								...item,
								content: summary,
								tokens: summaryTokens,
								metadata: {
									...item.metadata,
									summarized: true,
									originalTokens: itemTokens,
									summarizedTokens: summaryTokens,
								},
							})
							totalRemovedTokens += removedTokens
							summarizedCount++
						} else {
							newItems.push(item)
						}
					} catch {
						// If summarization fails, keep original
						newItems.push(item)
					}
				} else {
					newItems.push(item)
				}
			} else {
				newItems.push(item)
			}
		}

		if (summarizedCount > 0) {
			warnings.push(`Stage 2: Summarized ${summarizedCount} code blocks`)
		}

		const newTokens = this.estimateContextTokens(newItems)
		const removed = currentTokens - newTokens

		return {
			context: {
				...context,
				items: newItems,
				totalTokens: newTokens,
			},
			tokens: newTokens,
			removed,
			warnings,
		}
	}

	/**
	 * Summarize code content
	 */
	private async summarizeCode(code: string): Promise<string> {
		// Use smart summarizer if available
		try {
			const result = this.summarizer.summarizeFile(code)
			const parts: string[] = []

			if (result.preservedImports) {
				parts.push(result.preservedImports)
			}

			for (const cls of result.summarizedClasses) {
				parts.push(cls.classDefinition)
			}

			for (const func of result.summarizedFunctions) {
				parts.push(func.summary)
			}

			if (result.preservedExports) {
				parts.push(result.preservedExports)
			}

			return parts.join("\n\n") || code
		} catch {
			// Fallback to structure extraction
			return this.extractSignatures(code)
		}
	}

	/**
	 * Stage 3: Extract signatures only
	 */
	private stage3ExtractSignatures(
		context: BuiltContext,
		currentTokens: number,
		maxTokens: number,
		opts: Required<CompressionOptions>,
	): { context: BuiltContext; tokens: number; removed: number; warnings: string[] } {
		const warnings: string[] = []
		const newItems: ContextItem[] = []
		let totalRemovedTokens = 0
		let extractedCount = 0

		for (const item of context.items) {
			if (item.type === "code") {
				const itemTokens = this.estimateItemTokens(item)
				const signatures = this.extractSignatures(item.content)
				const signaturesTokens = this.estimateTokens(signatures)
				const removedTokens = itemTokens - signaturesTokens

				if (removedTokens > 0) {
					newItems.push({
						...item,
						content: signatures,
						tokens: signaturesTokens,
						metadata: {
							...item.metadata,
							signaturesOnly: true,
							originalTokens: itemTokens,
							signaturesTokens,
						},
					})
					totalRemovedTokens += removedTokens
					extractedCount++
				} else {
					newItems.push(item)
				}
			} else {
				newItems.push(item)
			}
		}

		if (extractedCount > 0) {
			warnings.push(`Stage 3: Extracted signatures from ${extractedCount} code blocks`)
		}

		const newTokens = this.estimateContextTokens(newItems)
		const removed = currentTokens - newTokens

		return {
			context: {
				...context,
				items: newItems,
				totalTokens: newTokens,
			},
			tokens: newTokens,
			removed,
			warnings,
		}
	}

	/**
	 * Extract signatures from code
	 */
	private extractSignatures(code: string): string {
		try {
			const classes = this.structureAnalyzer.extractClasses(code)
			const functions = this.structureAnalyzer.extractFunctions(code)
			const imports = this.structureAnalyzer.extractImports(code)
			const exports = this.structureAnalyzer.extractExports(code)
			const parts: string[] = []

			// Extract imports
			for (const imp of imports.slice(0, 5)) {
				const names = imp.importedNames.join(", ")
				parts.push(`import ${names} from '${imp.path}'`)
			}

			// Extract class/interface definitions
			for (const cls of classes) {
				const classParts: string[] = []
				if (cls.docComment) classParts.push(cls.docComment)
				classParts.push(`class ${cls.name}`)
				if (cls.extendsClause) classParts.push(cls.extendsClause)
				if (cls.implementsClauses?.length) classParts.push(`implements ${cls.implementsClauses.join(", ")}`)
				classParts.push("{")
				for (const method of cls.methods.slice(0, 3)) {
					classParts.push(`  ${method.signature}`)
				}
				if (cls.methods.length > 3) {
					classParts.push(`  // ... ${cls.methods.length - 3} more methods`)
				}
				for (const prop of cls.properties.slice(0, 3)) {
					classParts.push(`  ${prop.name}: ${prop.type}`)
				}
				classParts.push("}")
				classParts.push("")
			}

			// Extract function signatures
			for (const func of functions) {
				const funcParts: string[] = []
				if (func.docComment) funcParts.push(func.docComment)
				funcParts.push(func.signature)
				funcParts.push("{ /* body */ }")
				funcParts.push("")
			}

			return parts.join("\n")
		} catch {
			// Fallback: extract basic patterns
			const lines = code.split("\n")
			const signatures: string[] = []

			for (const line of lines) {
				const trimmed = line.trim()
				// Function/class declarations
				if (/^(class|interface|function|const|let|var|export|import)/.test(trimmed)) {
					signatures.push(trimmed)
				}
			}

			return signatures.slice(0, 30).join("\n")
		}
	}

	/**
	 * Stage 4: Aggressive truncation
	 */
	private stage4AggressiveTruncate(
		context: BuiltContext,
		currentTokens: number,
		maxTokens: number,
		opts: Required<CompressionOptions>,
	): { context: BuiltContext; tokens: number; removed: number; warnings: string[] } {
		const warnings: string[] = []
		const criticalTypes = new Set(opts.criticalTypes)

		// Sort items by relevance (descending)
		const sortedItems = [...context.items].sort((a, b) => b.relevance - a.relevance)

		const keptItems: ContextItem[] = []
		let keptTokens = 0

		for (const item of sortedItems) {
			const itemTokens = this.estimateItemTokens(item)

			// Always keep critical items
			if (criticalTypes.has(item.type)) {
				if (keptTokens + itemTokens <= maxTokens * 1.2) {
					keptItems.push(item)
					keptTokens += itemTokens
				}
			} else {
				// For non-critical items, be more strict
				if (keptTokens + itemTokens <= maxTokens * 0.5) {
					keptItems.push(item)
					keptTokens += itemTokens
				}
			}
		}

		const removed = context.items.length - keptItems.length
		const newTokens = keptTokens

		if (removed > 0) {
			warnings.push(`Stage 4: Aggressively truncated ${removed} items`)
		}

		// If still over budget, truncate content
		if (newTokens > maxTokens) {
			let truncatedTokens = 0
			const finalItems: ContextItem[] = []

			for (const item of keptItems) {
				const itemTokens = this.estimateItemTokens(item)
				if (truncatedTokens + itemTokens <= maxTokens) {
					finalItems.push(item)
					truncatedTokens += itemTokens
				} else {
					// Truncate content
					const remainingTokens = maxTokens - truncatedTokens
					const remainingChars = remainingTokens * 4
					const truncatedContent = item.content.substring(0, remainingChars)
					finalItems.push({
						...item,
						content: truncatedContent + "\n// ... truncated",
						tokens: remainingTokens,
						metadata: {
							...item.metadata,
							truncated: true,
						},
					})
					break
				}
			}

			warnings.push("Stage 4: Content truncated to fit token limit")
			return {
				context: {
					...context,
					items: finalItems,
					totalTokens: maxTokens,
				},
				tokens: maxTokens,
				removed: context.items.length - finalItems.length,
				warnings,
			}
		}

		return {
			context: {
				...context,
				items: keptItems,
				totalTokens: newTokens,
			},
			tokens: newTokens,
			removed,
			warnings,
		}
	}

	/**
	 * Quick compress - compress with default options
	 */
	async quickCompress(context: BuiltContext, maxTokens: number): Promise<CompressedContextResult> {
		return this.compress(context, maxTokens)
	}

	/**
	 * Get compression statistics for a potential compression
	 */
	async getCompressionStats(
		context: BuiltContext,
		maxTokens: number,
	): Promise<{ canCompress: boolean; estimatedRatio: number; stages: string[] }> {
		const originalTokens = context.totalTokens
		const canCompress = originalTokens > maxTokens
		const estimatedRatio = canCompress ? 1 - maxTokens / originalTokens : 0

		const stages: string[] = []
		if (originalTokens > maxTokens) {
			stages.push("Remove low-priority items")
			if (originalTokens * 0.7 > maxTokens) {
				stages.push("Summarize code blocks")
			}
			if (originalTokens * 0.5 > maxTokens) {
				stages.push("Extract signatures only")
			}
			if (originalTokens * 0.3 > maxTokens) {
				stages.push("Aggressive truncation")
			}
		}

		return {
			canCompress,
			estimatedRatio: Math.min(estimatedRatio, 0.9),
			stages,
		}
	}
}

/**
 * Create a default ContextCompressorV2 instance
 */
export function createContextCompressorV2(): ContextCompressorV2 {
	return new ContextCompressorV2()
}
