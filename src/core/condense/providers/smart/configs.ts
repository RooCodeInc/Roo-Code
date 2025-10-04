/**
 * Predefined Smart Provider Configurations (Spec 004)
 *
 * Three production-ready configurations with different trade-offs:
 * - CONSERVATIVE: Maximum quality, moderate cost
 * - BALANCED: Optimal balance of speed/cost/quality
 * - AGGRESSIVE: Maximum reduction, minimal cost
 */

import type { SmartProviderConfig } from "../../types"

/**
 * CONSERVATIVE Configuration
 *
 * Strategy: Quality-first with LLM summarization
 * - Lossless prelude enabled (all optimizations)
 * - Pass 1: Individual mode - LLM summarization of tool results (old content)
 * - Pass 2: Batch mode - Conditional fallback if still over target
 *
 * Expected Results:
 * - Reduction: 60-70%
 * - Cost: $0.02-0.05
 * - Quality: High
 * - Time: 3-8s
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
			id: "pass-1-quality",
			name: "LLM Summarization of Old Content",
			description: "High-quality summarization of tool results for messages older than recent 10",
			selection: {
				type: "preserve_recent",
				keepRecentCount: 10,
			},
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" },
					toolParameters: { operation: "keep" },
					toolResults: {
						operation: "summarize",
						params: {
							apiProfile: "claude-haiku", // Fast & cheap
							maxTokens: 150,
						},
					},
				},
			},
			execution: { type: "always" },
		},
		{
			id: "pass-2-fallback",
			name: "Batch Summary Fallback",
			description: "Batch summarization if still over 40K tokens",
			selection: {
				type: "preserve_percent",
				keepPercentage: 40,
			},
			mode: "batch",
			batchConfig: {
				operation: "summarize",
				summarizationConfig: {
					apiProfile: "gpt-4o-mini",
					keepFirst: 1,
					keepLast: 8,
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 40000 },
			},
		},
	],
}

/**
 * BALANCED Configuration
 *
 * Strategy: Quality-first LLM, then mechanical fallback, then batch old messages
 * - Lossless prelude enabled
 * - Pass 1: Individual mode - LLM summarization (always, quality first)
 * - Pass 2: Individual mode - Mechanical truncation (if > 40K tokens)
 * - Pass 3: Batch mode - Old messages summary (if > 30K tokens)
 *
 * Expected Results:
 * - Reduction: 70-80%
 * - Cost: $0.005-0.02
 * - Quality: Medium-High
 * - Time: 1-4s
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
		// Pass 1: LLM quality reduction first
		{
			id: "llm-quality",
			name: "LLM Summarization",
			description: "Quality-first summarization of tool results for old content",
			selection: { type: "preserve_recent", keepRecentCount: 10 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" },
					toolParameters: { operation: "keep" },
					toolResults: {
						operation: "summarize",
						params: {
							apiProfile: "gpt-4o-mini",
							maxTokens: 120,
						},
					},
				},
			},
			execution: { type: "always" },
		},
		// Pass 2: Mechanical truncation if LLM wasn't enough
		{
			id: "mechanical-fallback",
			name: "Mechanical Truncation Fallback",
			description: "Mechanical truncation if LLM summarization wasn't sufficient",
			selection: { type: "preserve_recent", keepRecentCount: 5 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" },
					toolParameters: {
						operation: "truncate",
						params: { maxChars: 100 },
					},
					toolResults: {
						operation: "truncate",
						params: { maxLines: 5 },
					},
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 40000 },
			},
		},
		// Pass 3: Batch old messages as last resort
		{
			id: "batch-old",
			name: "Batch Old Messages",
			description: "Batch summarization of oldest messages as last resort",
			selection: { type: "preserve_percent", keepPercentage: 30 },
			mode: "batch",
			batchConfig: {
				operation: "summarize",
				summarizationConfig: {
					apiProfile: "gpt-4o-mini",
					keepFirst: 1,
					keepLast: 8,
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 30000 },
			},
		},
	],
}

/**
 * AGGRESSIVE Configuration
 *
 * Strategy: Maximum reduction with minimal cost
 * - Lossless prelude enabled
 * - Pass 1: Individual mode - Suppress ancient content (always)
 * - Pass 2: Individual mode - Truncate middle zone (always)
 * - Pass 3: Batch mode - Emergency LLM (rare, if > 30K tokens)
 *
 * Expected Results:
 * - Reduction: 85-95%
 * - Cost: $0-0.01
 * - Quality: Low but predictable
 * - Time: <500ms
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
		// Pass 1: Suppress old content
		{
			id: "suppress-ancient",
			name: "Suppress Very Old",
			description: "Complete suppression of tool content beyond recent 30",
			selection: { type: "preserve_recent", keepRecentCount: 30 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" },
					toolParameters: { operation: "suppress" },
					toolResults: { operation: "suppress" },
				},
			},
			execution: { type: "always" },
		},
		// Pass 2: Truncate middle
		{
			id: "truncate-middle",
			name: "Truncate Middle Zone",
			description: "Aggressive truncation of middle messages",
			selection: { type: "preserve_recent", keepRecentCount: 10 },
			mode: "individual",
			individualConfig: {
				defaults: {
					messageText: { operation: "keep" },
					toolParameters: {
						operation: "truncate",
						params: { maxChars: 80 },
					},
					toolResults: {
						operation: "truncate",
						params: { maxLines: 3 },
					},
				},
			},
			execution: { type: "always" },
		},
		// Pass 3: Emergency LLM (rare)
		{
			id: "emergency-llm",
			name: "Emergency Batch Summary",
			description: "Last resort batch summarization",
			selection: { type: "preserve_percent", keepPercentage: 20 },
			mode: "batch",
			batchConfig: {
				operation: "summarize",
				summarizationConfig: {
					apiProfile: "gpt-4o-mini",
					keepFirst: 1,
					keepLast: 5,
				},
			},
			execution: {
				type: "conditional",
				condition: { tokenThreshold: 30000 },
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
