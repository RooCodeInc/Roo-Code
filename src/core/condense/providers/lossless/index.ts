import Anthropic from "@anthropic-ai/sdk"

import { BaseCondensationProvider } from "../../BaseProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../../types"
import { ApiMessage } from "../../../task-persistence/apiMessages"
import { FileDeduplicator } from "./deduplicator"
import { ToolResultConsolidator } from "./consolidator"

/**
 * LosslessProvider orchestrates file deduplication and tool result consolidation
 * to achieve maximum context reduction without information loss.
 *
 * Strategy:
 * 1. Apply file deduplication first (reduces content in messages)
 * 2. Apply tool result consolidation second (reduces redundant tool outputs)
 * 3. This sequential approach maximizes reduction while preserving all information
 *
 * Performance: <100ms overhead, zero API costs
 */
export class LosslessCondensationProvider extends BaseCondensationProvider {
	readonly id = "lossless"
	readonly name = "Lossless Condensation"
	readonly description = "Lossless context condensation through intelligent deduplication and consolidation"

	private deduplicator: FileDeduplicator
	private consolidator: ToolResultConsolidator

	constructor() {
		super()
		this.deduplicator = new FileDeduplicator()
		this.consolidator = new ToolResultConsolidator()
	}

	/**
	 * Condense messages using dual-strategy optimization
	 */
	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		const startTime = Date.now()
		const { messages } = context

		// 1. Apply file deduplication first
		const dedupResult = this.deduplicator.deduplicate(messages as Anthropic.MessageParam[])

		// 2. Apply tool result consolidation on deduplicated messages
		const consolidationResult = this.consolidator.consolidate(dedupResult.deduplicatedMessages)

		// 3. Merge results: replace tool_results in deduplicated messages with consolidated ones
		const finalMessages = this.mergeResults(dedupResult.deduplicatedMessages, consolidationResult) as ApiMessage[]

		// 4. Calculate final metrics
		const processingTime = Date.now() - startTime
		const originalTokens = this.estimateTokens(messages)
		const condensedTokens = this.estimateTokens(finalMessages)
		const tokensReduced = originalTokens - condensedTokens

		// 5. Determine which strategies were actually applied
		const strategiesApplied: string[] = []
		if (dedupResult.duplicateCount > 0) {
			strategiesApplied.push("file_deduplication")
		}
		strategiesApplied.push(...consolidationResult.metadata.strategiesApplied)

		return {
			messages: finalMessages,
			cost: 0, // Lossless provider is free - no API calls
			newContextTokens: condensedTokens,
			metrics: {
				providerId: this.id,
				timeElapsed: processingTime,
				tokensSaved: tokensReduced,
				originalTokens,
				condensedTokens,
				reductionPercentage: originalTokens > 0 ? (tokensReduced / originalTokens) * 100 : 0,
				strategiesApplied,
				fileDeduplication: {
					duplicatesRemoved: dedupResult.duplicateCount,
					uniqueFiles: dedupResult.uniqueFiles.size,
					tokensReduced: dedupResult.tokensBeforeDedup - dedupResult.tokensAfterDedup,
				},
				toolConsolidation: {
					originalCount: consolidationResult.metadata.originalCount,
					consolidatedCount: consolidationResult.metadata.consolidatedCount,
					tokensReduced: consolidationResult.metadata.tokensReduced,
				},
			},
		}
	}

	/**
	 * Estimate cost - lossless provider is always free
	 */
	async estimateCost(context: CondensationContext): Promise<number> {
		return 0 // No API calls = zero cost
	}

	/**
	 * Merge deduplicated messages with consolidated tool results
	 * Replaces tool_result blocks in messages with their consolidated versions
	 */
	private mergeResults(
		messages: Anthropic.MessageParam[],
		consolidation: ReturnType<ToolResultConsolidator["consolidate"]>,
	): Anthropic.MessageParam[] {
		// Build a map of tool_use_id -> consolidated result
		const consolidatedMap = new Map<string, (typeof consolidation.consolidatedContent)[0]>()
		consolidation.consolidatedContent.forEach((result) => {
			consolidatedMap.set(result.tool_use_id, result)
		})

		// Replace tool_results in messages with consolidated versions
		return messages.map((message) => {
			if (typeof message.content === "string") {
				return message
			}

			const updatedContent = message.content.map((block) => {
				if (block.type === "tool_result") {
					const consolidated = consolidatedMap.get(block.tool_use_id)
					if (consolidated) {
						return consolidated
					}
				}
				return block
			})

			return {
				...message,
				content: updatedContent,
			}
		})
	}

	/**
	 * Estimate total tokens for a list of messages
	 * Uses simple heuristic: ~4 characters per token
	 */
	private estimateTokens(messages: Anthropic.MessageParam[] | ApiMessage[]): number {
		let total = 0

		messages.forEach((message) => {
			if (typeof message.content === "string") {
				total += this.countTokens(message.content)
			} else {
				message.content.forEach((block) => {
					if (block.type === "text") {
						total += this.countTokens(block.text)
					} else if (block.type === "tool_result") {
						const content = block.content
						if (typeof content === "string") {
							total += this.countTokens(content)
						} else if (Array.isArray(content)) {
							content.forEach((c) => {
								if (c.type === "text") {
									total += this.countTokens(c.text)
								}
							})
						}
					}
				})
			}
		})

		return total
	}
}
