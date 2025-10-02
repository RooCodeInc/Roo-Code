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
