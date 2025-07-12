/**
 * IRetryStrategy - Core interface for retry logic strategies
 *
 * This interface defines the contract for implementing different retry strategies,
 * allowing flexible retry behavior without coupling to specific implementations.
 */

import { ErrorType } from "./types"

/**
 * Interface for implementing retry strategies
 */
export interface IRetryStrategy {
	/**
	 * Determine whether an error should be retried
	 *
	 * @param errorType - The classified error type
	 * @param attempt - The current attempt number (0-based)
	 * @returns Whether the operation should be retried
	 */
	shouldRetry(errorType: ErrorType, attempt: number): boolean

	/**
	 * Calculate the delay before the next retry attempt
	 *
	 * @param errorType - The classified error type
	 * @param attempt - The current attempt number (0-based)
	 * @returns Delay in seconds before the next retry
	 */
	calculateDelay(errorType: ErrorType, attempt: number): number
}
