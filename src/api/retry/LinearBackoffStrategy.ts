/**
 * LinearBackoffStrategy - Implements linear backoff retry strategy
 *
 * This strategy increases the delay linearly with each retry attempt,
 * providing a more predictable delay pattern than exponential backoff.
 */

import { IRetryStrategy } from "../../core/interfaces/IRetryStrategy"
import { ErrorType } from "../../core/interfaces/types"

export interface LinearBackoffConfig {
	/** Base delay in seconds for the first retry */
	baseDelay: number
	/** Increment in seconds for each subsequent retry */
	increment: number
	/** Maximum delay in seconds */
	maxDelay: number
	/** Maximum number of retry attempts */
	maxRetries: number
	/** Error types that are retryable with this strategy */
	retryableTypes: ErrorType[]
}

export class LinearBackoffStrategy implements IRetryStrategy {
	private readonly config: LinearBackoffConfig

	constructor(config?: Partial<LinearBackoffConfig>) {
		this.config = {
			baseDelay: 3, // 3 seconds
			increment: 2, // 2 seconds per attempt
			maxDelay: 300, // 5 minutes
			maxRetries: 5,
			retryableTypes: [
				"THROTTLING",
				"RATE_LIMITED",
				"SERVICE_UNAVAILABLE",
				"TIMEOUT",
				"NETWORK_ERROR",
				"QUOTA_EXCEEDED",
				"GENERIC",
			],
			...config,
		}
	}

	/**
	 * Determine whether an error should be retried
	 */
	shouldRetry(errorType: ErrorType, attempt: number): boolean {
		// Check if we've exceeded max retries
		if (attempt >= this.config.maxRetries) {
			return false
		}

		// Check if error type is retryable
		return this.config.retryableTypes.includes(errorType)
	}

	/**
	 * Calculate linear backoff delay
	 */
	calculateDelay(errorType: ErrorType, attempt: number): number {
		// If not retryable, return 0
		if (!this.shouldRetry(errorType, attempt)) {
			return 0
		}

		// Calculate linear backoff: baseDelay + (attempt * increment)
		const linearDelay = Math.min(this.config.baseDelay + attempt * this.config.increment, this.config.maxDelay)

		// Adjust based on error type
		return this.adjustDelayForErrorType(errorType, linearDelay)
	}

	/**
	 * Adjust delay based on error type characteristics
	 */
	private adjustDelayForErrorType(errorType: ErrorType, baseDelay: number): number {
		switch (errorType) {
			case "THROTTLING":
			case "RATE_LIMITED":
				return baseDelay // Standard linear backoff

			case "SERVICE_UNAVAILABLE":
				return Math.min(baseDelay * 1.3, this.config.maxDelay) // Slightly longer for service issues

			case "QUOTA_EXCEEDED":
				return Math.min(baseDelay * 1.5, this.config.maxDelay) // Longer for quota issues

			case "NETWORK_ERROR":
			case "TIMEOUT":
				return Math.min(baseDelay * 0.7, this.config.maxDelay) // Shorter for network issues

			default:
				return baseDelay
		}
	}

	/**
	 * Get configuration for debugging/monitoring
	 */
	getConfig(): LinearBackoffConfig {
		return { ...this.config }
	}
}
