import Anthropic from "@anthropic-ai/sdk"
import { ApiMessage } from "../../../task-persistence/apiMessages"

/**
 * Configuration for truncation strategy
 */
export interface TruncationConfig {
	/** Target token count after truncation */
	targetTokens: number
	/** Always preserve the first N messages */
	preserveFirst?: number
	/** Always preserve the last N messages */
	preserveRecent?: number
	/** Priority order for content removal (highest priority removed first) */
	priorityOrder?: ContentType[]
}

/**
 * Content types that can be prioritized for removal
 */
export enum ContentType {
	TOOL_RESULT = "tool_result",
	TOOL_USE = "tool_use",
	ASSISTANT_TEXT = "assistant_text",
	USER_TEXT = "user_text",
}

/**
 * Result of truncation operation
 */
export interface TruncationResult {
	/** Truncated messages */
	truncatedMessages: ApiMessage[]
	/** Original token count */
	originalTokens: number
	/** Final token count */
	finalTokens: number
	/** Messages that were removed */
	removedMessages: ApiMessage[]
	/** Details about what was removed */
	removalStats: RemovalStats
}

/**
 * Statistics about removed content
 */
export interface RemovalStats {
	messagesRemoved: number
	toolResultsRemoved: number
	toolUsesRemoved: number
	assistantTextRemoved: number
	userTextRemoved: number
}

/**
 * Priority-based truncation strategy
 * Removes content based on configured priorities while preserving conversation flow
 */
export class TruncationStrategy {
	private readonly defaultPriorities: ContentType[] = [
		ContentType.TOOL_RESULT, // Remove first - largest, least conversational value
		ContentType.TOOL_USE, // Remove second - technical details
		ContentType.ASSISTANT_TEXT, // Remove third - older assistant messages
		ContentType.USER_TEXT, // Remove last - preserve user intent as much as possible
	]

	/**
	 * Truncate messages to reach target token count
	 */
	truncate(messages: ApiMessage[], config: TruncationConfig): TruncationResult {
		const originalTokens = this.estimateTokens(messages)
		const preserveFirst = config.preserveFirst ?? 1 // Always keep first message (system context)
		const preserveRecent = config.preserveRecent ?? 10 // Keep last 10 messages by default
		const priorities = config.priorityOrder ?? this.defaultPriorities

		// If already under target, no truncation needed
		if (originalTokens <= config.targetTokens) {
			return {
				truncatedMessages: messages,
				originalTokens,
				finalTokens: originalTokens,
				removedMessages: [],
				removalStats: this.emptyStats(),
			}
		}

		// Separate messages into three groups
		const preservedFirst = messages.slice(0, preserveFirst)
		const preservedRecent = messages.slice(-preserveRecent)
		const removable = messages.slice(preserveFirst, messages.length - preserveRecent)

		// Apply priority-based removal
		const result = this.applyPriorityRemoval(
			preservedFirst,
			preservedRecent,
			removable,
			config.targetTokens,
			priorities,
			originalTokens,
		)

		return result
	}

	/**
	 * Apply priority-based removal to reach target tokens
	 */
	private applyPriorityRemoval(
		preservedFirst: ApiMessage[],
		preservedRecent: ApiMessage[],
		removable: ApiMessage[],
		targetTokens: number,
		priorities: ContentType[],
		originalTokens: number,
	): TruncationResult {
		const removed: ApiMessage[] = []
		const stats: RemovalStats = this.emptyStats()

		// Work with a copy of removable messages
		let workingMessages = [...removable]
		let currentTokens = this.estimateTokens([...preservedFirst, ...workingMessages, ...preservedRecent])

		// Remove content by priority until we reach target
		for (const priority of priorities) {
			if (currentTokens <= targetTokens) {
				break
			}

			// Find and remove content of this priority type
			const { kept, removed: priorityRemoved } = this.removeByPriority(workingMessages, priority)

			// Update stats
			this.updateStats(stats, priorityRemoved, priority)
			removed.push(...priorityRemoved)

			// Update working messages
			workingMessages = kept
			currentTokens = this.estimateTokens([...preservedFirst, ...workingMessages, ...preservedRecent])
		}

		// If still over target, remove entire messages (oldest first)
		while (currentTokens > targetTokens && workingMessages.length > 0) {
			const oldest = workingMessages.shift()!
			removed.push(oldest)
			stats.messagesRemoved++
			currentTokens = this.estimateTokens([...preservedFirst, ...workingMessages, ...preservedRecent])
		}

		return {
			truncatedMessages: [...preservedFirst, ...workingMessages, ...preservedRecent],
			originalTokens,
			finalTokens: currentTokens,
			removedMessages: removed,
			removalStats: stats,
		}
	}

	/**
	 * Remove content blocks of specific priority from messages
	 */
	private removeByPriority(
		messages: ApiMessage[],
		priority: ContentType,
	): { kept: ApiMessage[]; removed: ApiMessage[] } {
		const kept: ApiMessage[] = []
		const removed: ApiMessage[] = []

		for (const message of messages) {
			// Skip simple text messages for now
			if (typeof message.content === "string") {
				kept.push(message)
				continue
			}

			// Process content blocks
			const filteredBlocks: Anthropic.MessageParam["content"] = []
			let hadRemoval = false

			for (const block of message.content) {
				if (this.matchesPriority(block, priority)) {
					hadRemoval = true
					// Don't include this block
				} else {
					filteredBlocks.push(block)
				}
			}

			// If message still has content, keep it (modified)
			if (filteredBlocks.length > 0) {
				kept.push({
					...message,
					content: filteredBlocks as Anthropic.Messages.MessageParam["content"],
				})
			} else if (hadRemoval) {
				// Message was completely removed
				removed.push(message)
			}
		}

		return { kept, removed }
	}

	/**
	 * Check if content block matches priority type
	 */
	private matchesPriority(block: Anthropic.Messages.ContentBlockParam, priority: ContentType): boolean {
		switch (priority) {
			case ContentType.TOOL_RESULT:
				return block.type === "tool_result"
			case ContentType.TOOL_USE:
				return block.type === "tool_use"
			case ContentType.ASSISTANT_TEXT:
				return block.type === "text" // Will be refined by role
			case ContentType.USER_TEXT:
				return block.type === "text"
			default:
				return false
		}
	}

	/**
	 * Update removal statistics
	 */
	private updateStats(stats: RemovalStats, removed: ApiMessage[], priority: ContentType): void {
		switch (priority) {
			case ContentType.TOOL_RESULT:
				stats.toolResultsRemoved += removed.length
				break
			case ContentType.TOOL_USE:
				stats.toolUsesRemoved += removed.length
				break
			case ContentType.ASSISTANT_TEXT:
				stats.assistantTextRemoved += removed.length
				break
			case ContentType.USER_TEXT:
				stats.userTextRemoved += removed.length
				break
		}
	}

	/**
	 * Estimate token count for messages (rough approximation)
	 */
	private estimateTokens(messages: ApiMessage[]): number {
		let total = 0

		for (const message of messages) {
			if (typeof message.content === "string") {
				total += Math.ceil(message.content.length / 4) // ~4 chars per token
			} else {
				for (const block of message.content) {
					if (block.type === "text") {
						total += Math.ceil(block.text.length / 4)
					} else if (block.type === "tool_use") {
						total += Math.ceil(JSON.stringify(block.input).length / 4)
					} else if (block.type === "tool_result") {
						const content =
							typeof block.content === "string" ? block.content : JSON.stringify(block.content)
						total += Math.ceil(content.length / 4)
					}
				}
			}
		}

		return total
	}

	/**
	 * Create empty removal stats
	 */
	private emptyStats(): RemovalStats {
		return {
			messagesRemoved: 0,
			toolResultsRemoved: 0,
			toolUsesRemoved: 0,
			assistantTextRemoved: 0,
			userTextRemoved: 0,
		}
	}
}
