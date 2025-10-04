/**
 * Condensation provider system types and interfaces
 * This file defines the core abstractions for the provider pattern
 */

import { ApiMessage } from "../task-persistence/apiMessages"
import { ApiHandler } from "../../api/index"

/**
 * Context to be condensed - input for providers
 */
export interface CondensationContext {
	/** Messages to condense */
	messages: ApiMessage[]
	/** System prompt for context */
	systemPrompt: string
	/** Task identifier */
	taskId: string
	/** Previous context token count */
	prevContextTokens: number
	/** Target token count after condensation */
	targetTokens?: number
}

/**
 * Options for condensation operation
 */
export interface CondensationOptions {
	/** Main API handler */
	apiHandler: ApiHandler
	/** Optional dedicated handler for condensation */
	condensingApiHandler?: ApiHandler
	/** Custom prompt for condensation */
	customCondensingPrompt?: string
	/** Whether this is automatic trigger */
	isAutomaticTrigger?: boolean
	/** Profile-specific thresholds */
	profileThresholds?: Record<string, number>
	/** Current profile ID */
	currentProfileId?: string
}

/**
 * Result of condensation operation
 */
export interface CondensationResult {
	/** Condensed messages */
	messages: ApiMessage[]
	/** Optional summary text */
	summary?: string
	/** Cost of condensation operation */
	cost: number
	/** New context token count */
	newContextTokens?: number
	/** Error if operation failed */
	error?: string
	/** Provider-specific metrics */
	metrics?: ProviderMetrics
}

/**
 * Metrics captured by providers
 */
export interface ProviderMetrics {
	/** Provider identifier */
	providerId: string
	/** Time elapsed in ms */
	timeElapsed: number
	/** Tokens saved */
	tokensSaved?: number
	/** Provider-specific data */
	[key: string]: any
}

/**
 * Smart Provider Analysis Result
 */
export interface SmartProviderAnalysis {
	totalMessages: number
	conversationMessages: number
	toolMessages: number
	toolHeavyRatio: number
	estimatedTokens: number
	isEmergency: boolean
	isLarge: boolean
	isToolHeavy: boolean
}

/**
 * Smart Provider Metadata
 */
export interface SmartProviderMetadata {
	selectedProvider: string
	actualProvider?: string
	analysis: SmartProviderAnalysis
	fallbackUsed: boolean
	fallbackReason?: string
	selectionReason: string
}

/**
 * Base interface for all condensation providers
 */
export interface ICondensationProvider {
	/** Unique provider identifier */
	readonly id: string
	/** Human-readable name */
	readonly name: string
	/** Provider description */
	readonly description: string

	/**
	 * Condense conversation context
	 * @param context Context to condense
	 * @param options Condensation options
	 * @returns Condensation result
	 */
	condense(context: CondensationContext, options: CondensationOptions): Promise<CondensationResult>

	/**
	 * Estimate cost of condensing given context
	 * @param context Context to estimate
	 * @returns Estimated cost in dollars
	 */
	estimateCost(context: CondensationContext): Promise<number>

	/**
	 * Validate that provider can handle the request
	 * @param context Context to validate
	 * @param options Options to validate
	 * @returns True if valid, error message if not
	 */
	validate(context: CondensationContext, options: CondensationOptions): Promise<{ valid: boolean; error?: string }>
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
	/** Provider ID */
	id: string
	/** Whether provider is enabled */
	enabled: boolean
	/** Priority (lower = higher priority) */
	priority: number
	/** Provider-specific config */
	config?: Record<string, any>
}

// ============================================================================
// Smart Provider Pass-Based Architecture Types (Spec 004)
// ============================================================================

/**
 * Decomposed message into 3 content types
 */
export interface DecomposedMessage {
	messageIndex: number
	originalMessage: ApiMessage
	messageText: string | null
	toolParameters: any[] | null
	toolResults: any[] | null
}

/**
 * Parameters for TRUNCATE operation
 */
export interface TruncateParams {
	maxChars?: number
	maxLines?: number
	addEllipsis?: boolean
}

/**
 * Parameters for SUMMARIZE operation
 */
export interface SummarizeParams {
	apiProfile?: string
	maxTokens?: number
	customPrompt?: string
}

/**
 * The 4 operations available for content
 */
export type ContentOperation =
	| { operation: "keep" }
	| { operation: "suppress" }
	| { operation: "truncate"; params: TruncateParams }
	| { operation: "summarize"; params: SummarizeParams }

/**
 * Operations configuration per content type
 */
export interface ContentTypeOperations {
	messageText: ContentOperation
	toolParameters: ContentOperation
	toolResults: ContentOperation
}

/**
 * Selection strategy for pass
 */
export interface SelectionStrategy {
	type: "preserve_recent" | "preserve_percent" | "custom"
	keepRecentCount?: number
	keepPercentage?: number
	customSelector?: (messages: ApiMessage[]) => ApiMessage[]
}

/**
 * Batch mode configuration
 */
export interface BatchModeConfig {
	operation: "keep" | "summarize"
	summarizationConfig?: {
		apiProfile?: string
		customPrompt?: string
		keepFirst: number
		keepLast: number
	}
}

/**
 * Individual mode configuration
 */
export interface IndividualModeConfig {
	defaults: ContentTypeOperations
	/** Optional token thresholds per content type (Phase 4.5) */
	messageTokenThresholds?: {
		messageText?: number
		toolParameters?: number
		toolResults?: number
	}
	overrides?: Array<{
		messageIndex: number
		operations: Partial<ContentTypeOperations>
		/** Optional token thresholds override for this message */
		messageTokenThresholds?: {
			messageText?: number
			toolParameters?: number
			toolResults?: number
		}
	}>
}

/**
 * Execution condition for pass
 */
export interface ExecutionCondition {
	type: "always" | "conditional"
	condition?: {
		tokenThreshold?: number
	}
}

/**
 * Complete pass configuration
 */
export interface PassConfig {
	id: string
	name: string
	description?: string
	selection: SelectionStrategy
	mode: "batch" | "individual"
	batchConfig?: BatchModeConfig
	individualConfig?: IndividualModeConfig
	execution: ExecutionCondition
}

/**
 * Complete Smart Provider configuration
 */
export interface SmartProviderConfig {
	losslessPrelude?: {
		enabled: boolean
		operations?: {
			deduplicateFileReads?: boolean
			consolidateToolResults?: boolean
			removeObsoleteState?: boolean
		}
	}
	passes: PassConfig[]
}

/**
 * Result of a single pass execution
 */
export interface PassResult {
	messages: ApiMessage[]
	cost: number
	tokensSaved: number
	passId: string
}
