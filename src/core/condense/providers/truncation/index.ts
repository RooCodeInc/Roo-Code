import Anthropic from "@anthropic-ai/sdk"

import { BaseCondensationProvider } from "../../BaseProvider"
import type { CondensationContext, CondensationOptions, CondensationResult } from "../../types"
import { ApiMessage } from "../../../task-persistence/apiMessages"
import { TruncationStrategy, TruncationConfig, ContentType } from "./strategy"

/**
 * TruncationProvider implements fast, free truncation using priority-based removal.
 *
 * Strategy:
 * 1. Preserve first message (system context) and recent messages (conversation continuity)
 * 2. Remove content by priority: tool_results → tool_uses → assistant_text → user_text
 * 3. Fast performance (<10ms target) with zero API costs
 *
 * Use when:
 * - Budget is tight (free alternative to LLM-based condensation)
 * - Speed is critical (10-100x faster than LLM providers)
 * - Simple reduction is acceptable (information loss expected)
 *
 * Performance: <10ms overhead, zero API costs
 */
export class TruncationCondensationProvider extends BaseCondensationProvider {
	readonly id = "truncation"
	readonly name = "Truncation (Simple)"
	readonly description = "Fast, free truncation with priority-based content removal"

	private strategy: TruncationStrategy

	constructor(
		private config: Partial<TruncationConfig> = {
			preserveFirst: 1, // Always keep first message
			preserveRecent: 10, // Keep last 10 messages
			priorityOrder: [
				ContentType.TOOL_RESULT,
				ContentType.TOOL_USE,
				ContentType.ASSISTANT_TEXT,
				ContentType.USER_TEXT,
			],
		},
	) {
		super()
		this.strategy = new TruncationStrategy()
	}

	/**
	 * Truncate messages using priority-based removal
	 */
	protected async condenseInternal(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<CondensationResult> {
		const startTime = Date.now()
		const { messages, targetTokens, prevContextTokens } = context

		// Determine target (50% reduction if not specified)
		const target = targetTokens ?? Math.floor(prevContextTokens * 0.5)

		// Apply truncation strategy
		const truncationConfig: TruncationConfig = {
			targetTokens: target,
			preserveFirst: this.config.preserveFirst,
			preserveRecent: this.config.preserveRecent,
			priorityOrder: this.config.priorityOrder,
		}

		const result = this.strategy.truncate(messages as Anthropic.MessageParam[], truncationConfig)

		// Calculate final metrics
		const processingTime = Date.now() - startTime
		const tokensReduced = result.originalTokens - result.finalTokens
		const reductionPercentage = result.originalTokens > 0 ? (tokensReduced / result.originalTokens) * 100 : 0

		return {
			messages: result.truncatedMessages as ApiMessage[],
			cost: 0, // Truncation is free - no API calls
			newContextTokens: result.finalTokens,
			summary: this.generateSummary(result, reductionPercentage),
			metrics: {
				providerId: this.id,
				timeElapsed: processingTime,
				tokensSaved: tokensReduced,
				originalTokens: result.originalTokens,
				condensedTokens: result.finalTokens,
				reductionPercentage,
				removalStats: result.removalStats,
				messagesRemoved: result.removedMessages.length,
			},
		}
	}

	/**
	 * Generate summary of truncation operation
	 */
	private generateSummary(result: any, reductionPercentage: number): string {
		const stats = result.removalStats
		const parts: string[] = []

		if (stats.toolResultsRemoved > 0) {
			parts.push(`${stats.toolResultsRemoved} tool results`)
		}
		if (stats.toolUsesRemoved > 0) {
			parts.push(`${stats.toolUsesRemoved} tool uses`)
		}
		if (stats.assistantTextRemoved > 0) {
			parts.push(`${stats.assistantTextRemoved} assistant texts`)
		}
		if (stats.userTextRemoved > 0) {
			parts.push(`${stats.userTextRemoved} user texts`)
		}
		if (stats.messagesRemoved > 0) {
			parts.push(`${stats.messagesRemoved} complete messages`)
		}

		const removed = parts.length > 0 ? parts.join(", ") : "no content"

		return `Truncation applied: removed ${removed} (${reductionPercentage.toFixed(1)}% reduction)`
	}

	/**
	 * Estimate cost - always free
	 */
	async estimateCost(_context: CondensationContext): Promise<number> {
		return 0
	}

	/**
	 * Validate truncation request
	 */
	override async validate(
		context: CondensationContext,
		options: CondensationOptions,
	): Promise<{ valid: boolean; error?: string }> {
		// Basic validation from base class
		const baseValidation = await super.validate(context, options)
		if (!baseValidation.valid) {
			return baseValidation
		}

		// Truncation-specific validation
		if (context.messages.length <= 1) {
			return {
				valid: false,
				error: "Need at least 2 messages to truncate (first message is always preserved)",
			}
		}

		return { valid: true }
	}

	/**
	 * Estimate token count for messages (internal helper)
	 */
	private estimateTokens(messages: ApiMessage[]): number {
		return this.strategy["estimateTokens"](messages) // Access private method
	}
}
