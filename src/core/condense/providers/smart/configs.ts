/**
 * Smart Provider Configurations - Qualitative Context Preservation
 *
 * Three production-ready configurations focused on qualitative preservation:
 * - CONSERVATIVE: Maximum context preservation, critical conversations
 * - BALANCED: Balanced preservation vs reduction, general use
 * - AGGRESSIVE: Aggressive reduction of non-essential content, long conversations
 *
 * Philosophy: Focus on WHAT to preserve rather than HOW MUCH to reduce
 */

import type { SmartProviderConfig } from "../../types"

/**
 * CONSERVATIVE Configuration - Qualitative Context Preservation
 *
 * Strategy: Preserve maximum conversation context and grounding
 * - Lossless prelude enabled (all optimizations)
 * - Pass 1: Individual mode - Gentle summarization of very old tool results only
 * - Pass 2: Context-aware fallback preserving conversation flow
 *
 * Qualitative Goals:
 * - Preserve ALL user/assistant conversation messages
 * - Keep all tool parameters for context understanding
 * - Only summarize very old, large tool results
 * - Maintain conversation grounding and flow
 * - Error messages always preserved (critical for debugging)
 */
export const CONSERVATIVE_CONFIG: SmartProviderConfig = {
	losslessPrelude: {
		enabled: true,
		operations: {
			deduplicateFileReads: true,
			consolidateToolResults: true,
			removeObsoleteState: true,
		},
	},
	passes: [
		{
			id: "conservative-preserve-conversation",
			name: "Preserve Conversation Context",
			description: "Keep all conversation messages, gently summarize very old tool results",
			selection: {
				type: "preserve_recent",
				keepRecentCount: 20, // Increased to preserve more context
			},
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" }, // Never summarize conversation
					toolParameters: { operation: "keep" }, // Always preserve parameters
					toolResults: {
						operation: "summarize",
						params: {
							maxTokens: 200, // Increased for better preservation
						},
					},
				},
				// Only summarize very large tool results from old messages
				messageTokenThresholds: {
					toolResults: 4000, // Increased threshold - only summarize very large results
				},
			},
			execution: { type: "always" },
		},
		{
			id: "conservative-context-fallback",
			name: "Context-Aware Fallback",
			description: "Preserve conversation flow if context is still large",
			selection: {
				type: "preserve_recent",
				keepRecentCount: 15, // Keep most recent conversation
			},
			mode: "batch",
			batchConfig: {
				operation: "summarize",
				summarizationConfig: {
					keepFirst: 2, // Keep more conversation start
					keepLast: 12, // Keep more conversation end
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 60000 }, // Higher threshold before fallback
			},
		},
	],
}

/**
 * BALANCED Configuration - Qualitative Context Preservation
 *
 * Strategy: Balance between preservation and reduction of non-essential content
 * - Lossless prelude enabled
 * - Pass 1: Individual mode - Smart summarization of tool content (preserve conversation)
 * - Pass 2: Mechanical truncation of large tool outputs only
 * - Pass 3: Batch summarization of very old messages as last resort
 *
 * Qualitative Goals:
 * - Preserve recent conversation messages (last 10-15)
 * - Keep essential tool parameters for context
 * - Summarize tool results intelligently based on size and age
 * - Truncate only large, non-essential tool outputs
 * - Maintain conversation coherence
 */
export const BALANCED_CONFIG: SmartProviderConfig = {
	losslessPrelude: {
		enabled: true,
		operations: {
			deduplicateFileReads: true,
			consolidateToolResults: true,
			removeObsoleteState: true,
		},
	},
	passes: [
		// Pass 1: Preserve conversation, summarize old tool content
		{
			id: "balanced-conversation-first",
			name: "Preserve Conversation, Summarize Tools",
			description: "Keep conversation intact, intelligently summarize old tool results",
			selection: { type: "preserve_recent", keepRecentCount: 12 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" }, // Preserve conversation
					toolParameters: { operation: "keep" }, // Keep parameters for context
					toolResults: {
						operation: "summarize",
						params: {
							maxTokens: 150,
						},
					},
				},
				// Moderate thresholds for balanced approach
				messageTokenThresholds: {
					toolResults: 2000, // Summarize tool results >2K tokens
				},
			},
			execution: { type: "always" },
		},
		// Pass 2: Truncate large tool outputs if needed
		{
			id: "balanced-tool-truncation",
			name: "Truncate Large Tool Outputs",
			description: "Truncate large tool outputs while preserving conversation context",
			selection: { type: "preserve_recent", keepRecentCount: 8 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" }, // Always keep conversation
					toolParameters: {
						operation: "truncate",
						params: { maxChars: 200 }, // Increased for better context
					},
					toolResults: {
						operation: "truncate",
						params: { maxLines: 8 }, // Increased for better preservation
					},
				},
				// Higher thresholds for truncation
				messageTokenThresholds: {
					toolParameters: 1000, // Truncate params >1K tokens
					toolResults: 1500, // Truncate results >1.5K tokens
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 50000 }, // Higher threshold before truncation
			},
		},
		// Pass 3: Last resort batch summarization
		{
			id: "balanced-batch-fallback",
			name: "Batch Summarization Last Resort",
			description: "Summarize very old messages only if context is still too large",
			selection: {
				type: "preserve_recent",
				keepRecentCount: 10, // Preserve recent conversation
			},
			mode: "batch",
			batchConfig: {
				operation: "summarize",
				summarizationConfig: {
					keepFirst: 2, // Keep conversation start
					keepLast: 10, // Keep recent conversation
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 40000 }, // Higher threshold for batch
			},
		},
	],
}

/**
 * AGGRESSIVE Configuration - Qualitative Context Preservation
 *
 * Strategy: Aggressive reduction while preserving essential conversation context
 * - Lossless prelude enabled
 * - Pass 1: Individual mode - Suppress non-essential tool content from old messages
 * - Pass 2: Individual mode - Truncate middle zone tool outputs
 * - Pass 3: Batch mode - Emergency summarization of very old messages
 *
 * Qualitative Goals:
 * - Preserve most recent conversation (last 8-10 messages)
 * - Keep essential tool parameters from recent messages only
 * - Aggressively reduce tool outputs from middle/old messages
 * - Maintain conversation coherence with recent context
 * - Minimize non-essential content while preserving grounding
 */
export const AGGRESSIVE_CONFIG: SmartProviderConfig = {
	losslessPrelude: {
		enabled: true,
		operations: {
			deduplicateFileReads: true,
			consolidateToolResults: true,
			removeObsoleteState: true,
		},
	},
	passes: [
		// Pass 1: Suppress non-essential tool content from old messages
		{
			id: "aggressive-suppress-old-tools",
			name: "Suppress Old Tool Content",
			description: "Remove non-essential tool content from old messages, preserve recent conversation",
			selection: { type: "preserve_recent", keepRecentCount: 25 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" }, // Always preserve conversation
					toolParameters: { operation: "suppress" }, // Remove old parameters
					toolResults: { operation: "suppress" }, // Remove old results
				},
				// Lower thresholds for aggressive suppression
				messageTokenThresholds: {
					toolParameters: 200, // Suppress smaller params
					toolResults: 300, // Suppress smaller results
				},
			},
			execution: { type: "always" },
		},
		// Pass 2: Truncate middle zone tool outputs
		{
			id: "aggressive-truncate-middle",
			name: "Truncate Middle Zone",
			description: "Aggressive truncation of tool outputs in middle messages",
			selection: { type: "preserve_recent", keepRecentCount: 8 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" }, // Keep conversation
					toolParameters: {
						operation: "truncate",
						params: { maxChars: 100 },
					},
					toolResults: {
						operation: "truncate",
						params: { maxLines: 4 },
					},
				},
				// Aggressive thresholds for truncation
				messageTokenThresholds: {
					toolParameters: 300, // Truncate smaller params
					toolResults: 400, // Truncate smaller results
				},
			},
			execution: { type: "always" },
		},
		// Pass 3: Emergency batch summarization
		{
			id: "aggressive-emergency-batch",
			name: "Emergency Batch Summarization",
			description: "Last resort batch summarization of very old messages",
			selection: {
				type: "preserve_recent",
				keepRecentCount: 6, // Keep only recent conversation
			},
			mode: "batch",
			batchConfig: {
				operation: "summarize",
				summarizationConfig: {
					keepFirst: 1, // Minimal conversation start
					keepLast: 6, // Keep recent conversation
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 35000 }, // Lower threshold for emergency
			},
		},
	],
}

/**
 * Get configuration by name
 */
export function getConfigByName(name: "conservative" | "balanced" | "aggressive"): SmartProviderConfig {
	switch (name) {
		case "conservative":
			return CONSERVATIVE_CONFIG
		case "balanced":
			return BALANCED_CONFIG
		case "aggressive":
			return AGGRESSIVE_CONFIG
		default:
			return BALANCED_CONFIG
	}
}
