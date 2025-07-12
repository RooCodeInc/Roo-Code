/**
 * RetryStrategyFactory - Factory for creating appropriate retry strategies
 *
 * This factory determines the best retry strategy based on error type,
 * context, and configuration, allowing for flexible retry behavior.
 */

import { IRetryStrategy } from "../../core/interfaces/IRetryStrategy"
import { ErrorType, ErrorContext } from "../../core/interfaces/types"
import { ExponentialBackoffStrategy, ExponentialBackoffConfig } from "./ExponentialBackoffStrategy"
import { LinearBackoffStrategy, LinearBackoffConfig } from "./LinearBackoffStrategy"
import { NoRetryStrategy } from "./NoRetryStrategy"

/**
 * Available retry strategy types
 */
export type RetryStrategyType = "exponential" | "linear" | "none"

/**
 * Configuration for the retry strategy factory
 */
export interface RetryStrategyFactoryConfig {
	/** Default strategy type to use */
	defaultStrategy: RetryStrategyType
	/** Strategy to use for specific error types */
	errorTypeStrategies: Partial<Record<ErrorType, RetryStrategyType>>
	/** Configuration for exponential backoff strategy */
	exponentialConfig: Partial<ExponentialBackoffConfig>
	/** Configuration for linear backoff strategy */
	linearConfig: Partial<LinearBackoffConfig>
	/** Whether to use provider-specific retry delays when available */
	useProviderDelays: boolean
}

export class RetryStrategyFactory {
	private readonly config: RetryStrategyFactoryConfig
	private readonly strategies: Map<RetryStrategyType, IRetryStrategy>

	constructor(config?: Partial<RetryStrategyFactoryConfig>) {
		const defaultConfig: RetryStrategyFactoryConfig = {
			defaultStrategy: "exponential",
			errorTypeStrategies: {
				ACCESS_DENIED: "none",
				NOT_FOUND: "none",
				INVALID_REQUEST: "none",
				QUOTA_EXCEEDED: "linear", // Linear might be better for quota issues
				NETWORK_ERROR: "exponential",
				TIMEOUT: "exponential",
				THROTTLING: "exponential",
				RATE_LIMITED: "exponential",
				SERVICE_UNAVAILABLE: "exponential",
				GENERIC: "exponential",
			},
			exponentialConfig: {},
			linearConfig: {},
			useProviderDelays: true,
		}

		this.config = {
			...defaultConfig,
			...config,
			// Deep merge errorTypeStrategies
			errorTypeStrategies: {
				...defaultConfig.errorTypeStrategies,
				...config?.errorTypeStrategies,
			},
		}

		// Initialize strategy instances
		this.strategies = new Map([
			["exponential", new ExponentialBackoffStrategy(this.config.exponentialConfig)],
			["linear", new LinearBackoffStrategy(this.config.linearConfig)],
			["none", new NoRetryStrategy()],
		])
	}

	/**
	 * Create the appropriate retry strategy for the given error type and context
	 */
	createStrategy(errorType: ErrorType, context?: ErrorContext): IRetryStrategy {
		const strategyType = this.determineStrategyType(errorType, context)
		const strategy = this.strategies.get(strategyType)

		if (!strategy) {
			// Fallback to default strategy
			return this.strategies.get(this.config.defaultStrategy) || this.strategies.get("exponential")!
		}

		return strategy
	}

	/**
	 * Create a strategy that respects provider-specific delays
	 */
	createProviderAwareStrategy(errorType: ErrorType, providerDelay?: number, context?: ErrorContext): IRetryStrategy {
		if (this.config.useProviderDelays && providerDelay && providerDelay > 0) {
			return new ProviderDelayStrategy(providerDelay, errorType)
		}

		return this.createStrategy(errorType, context)
	}

	/**
	 * Get all available strategy types
	 */
	getAvailableStrategies(): RetryStrategyType[] {
		return Array.from(this.strategies.keys())
	}

	/**
	 * Get configuration for debugging/monitoring
	 */
	getConfig(): RetryStrategyFactoryConfig {
		return { ...this.config }
	}

	/**
	 * Determine which strategy type to use based on error type and context
	 */
	private determineStrategyType(errorType: ErrorType, context?: ErrorContext): RetryStrategyType {
		// Check context-specific logic first (context can override error-specific strategies)
		if (context) {
			// For high retry attempts, consider switching to linear or no retry
			if (context.retryAttempt && context.retryAttempt >= 3) {
				if (errorType === "SERVICE_UNAVAILABLE") {
					return "linear" // Switch to linear for persistent service issues
				}
			}

			// For streaming contexts, prefer exponential backoff for throttling errors
			if (context.isStreaming && (errorType === "THROTTLING" || errorType === "RATE_LIMITED")) {
				return "exponential"
			}
		}

		// Check for error-type specific strategy
		const errorSpecificStrategy = this.config.errorTypeStrategies[errorType]
		if (errorSpecificStrategy) {
			return errorSpecificStrategy
		}

		// Default strategy
		return this.config.defaultStrategy
	}
}

/**
 * Special strategy that respects provider-specific retry delays
 */
class ProviderDelayStrategy implements IRetryStrategy {
	constructor(
		private readonly providerDelay: number,
		private readonly errorType: ErrorType,
	) {}

	shouldRetry(errorType: ErrorType, attempt: number): boolean {
		// Respect provider delays only for the first few attempts
		if (attempt >= 3) {
			return false
		}

		// Only retry certain error types even with provider delays
		const retryableTypes: ErrorType[] = ["THROTTLING", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "QUOTA_EXCEEDED"]

		return retryableTypes.includes(errorType)
	}

	calculateDelay(errorType: ErrorType, attempt: number): number {
		if (!this.shouldRetry(errorType, attempt)) {
			return 0
		}

		// Use provider delay for first attempt, then fallback to exponential
		if (attempt === 0) {
			return this.providerDelay
		}

		// Fallback to exponential backoff for subsequent attempts
		const baseDelay = Math.max(this.providerDelay, 5)
		return Math.min(baseDelay * Math.pow(2, attempt), 600)
	}
}
