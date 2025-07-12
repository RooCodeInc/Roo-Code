/**
 * IRateLimitManager - Core interface for managing rate limits
 *
 * This interface defines the contract for rate limit management,
 * allowing different implementations without coupling to specific storage mechanisms.
 */

/**
 * Interface for managing rate limits across the application
 */
export interface IRateLimitManager {
	/**
	 * Calculate the delay needed before the next request can be made
	 *
	 * @param rateLimitSeconds - The rate limit window in seconds
	 * @returns The delay in milliseconds to wait before the next request
	 */
	calculateDelay(rateLimitSeconds: number): Promise<number>

	/**
	 * Update the timestamp of the last request
	 *
	 * @param timestamp - Optional timestamp to set (defaults to current time)
	 */
	updateLastRequestTime(timestamp?: number): Promise<void>

	/**
	 * Get the timestamp of the last request
	 *
	 * @returns The timestamp of the last request, or null if no requests have been made
	 */
	getLastRequestTime(): Promise<number | null>

	/**
	 * Reset the rate limit state
	 */
	reset(): void
}
