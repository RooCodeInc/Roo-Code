/**
 * NoRetryStrategy - Implements a no-retry strategy
 *
 * This strategy never retries errors, useful for critical errors
 * or when you want to fail fast without any retry attempts.
 */

import { IRetryStrategy } from "../../core/interfaces/IRetryStrategy"
import { ErrorType } from "../../core/interfaces/types"

export class NoRetryStrategy implements IRetryStrategy {
	/**
	 * Never retry any errors
	 */
	shouldRetry(errorType: ErrorType, attempt: number): boolean {
		return false
	}

	/**
	 * Always return 0 delay since we don't retry
	 */
	calculateDelay(errorType: ErrorType, attempt: number): number {
		return 0
	}
}
