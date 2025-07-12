/**
 * ExponentialBackoffStrategy - Implements exponential backoff retry strategy
 *
 * This strategy increases the delay exponentially with each retry attempt,
 * providing a balanced approach between quick recovery and avoiding system overload.
 */

import { IRetryStrategy } from "../../core/interfaces/IRetryStrategy"
import { ErrorType } from "../../core/interfaces/types"

export interface ExponentialBackoffConfig {
	/** Base delay in seconds for the first retry */
	baseDelay: number
	/** Maximum delay in seconds */
	maxDelay: number
	/** Maximum number of retry attempts */
	maxRetries: number
	/** Multiplier for delay calculation */
	multiplier: number
	/** Error types that are retryable with this strategy */
	retryableTypes: ErrorType[]
}

export class ExponentialBackoffStrategy implements IRetryStrategy {
	private readonly config: ExponentialBackoffConfig

	constructor(config?: Partial<ExponentialBackoffConfig>) {
		this.config = {
			baseDelay: 5, // 5 seconds
			maxDelay: 600, // 10 minutes
			maxRetries: 5,
			multiplier: 2,
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
	 * Calculate exponential backoff delay
	 */
	calculateDelay(errorType: ErrorType, attempt: number): number {
		// If not retryable, return 0
		if (!this.shouldRetry(errorType, attempt)) {
			return 0
		}

		// Calculate exponential backoff - for attempt 0, return base delay
		let exponentialDelay: number
		if (attempt === 0) {
			exponentialDelay = this.config.baseDelay
		} else {
			exponentialDelay = Math.min(
				Math.ceil(this.config.baseDelay * Math.pow(this.config.multiplier, attempt)),
				this.config.maxDelay,
			)
		}

		// Adjust based on error type
		return this.adjustDelayForErrorType(errorType, exponentialDelay)
	}

	/**
	 * Adjust delay based on error type characteristics
	 */
	private adjustDelayForErrorType(errorType: ErrorType, baseDelay: number): number {
		switch (errorType) {
			case "THROTTLING":
			case "RATE_LIMITED":
				return baseDelay // Standard exponential backoff

			case "SERVICE_UNAVAILABLE":
				return Math.min(baseDelay * 1.5, this.config.maxDelay) // Slightly longer for service issues

			case "QUOTA_EXCEEDED":
				return Math.min(baseDelay * 2, this.config.maxDelay) // Longer for quota issues

			case "NETWORK_ERROR":
			case "TIMEOUT":
				return Math.min(baseDelay * 0.5, this.config.maxDelay) // Shorter for network issues

			default:
				return baseDelay
		}
	}

	/**
	 * Get configuration for debugging/monitoring
	 */
	getConfig(): ExponentialBackoffConfig {
		return { ...this.config }
	}
}
