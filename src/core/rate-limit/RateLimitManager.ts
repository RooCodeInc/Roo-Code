import { IRateLimitManager } from "../interfaces/IRateLimitManager"
import { TaskStateLock } from "../task/TaskStateLock"

/**
 * RateLimitManager - Manages rate limiting for API requests
 *
 * This class implements the IRateLimitManager interface and provides
 * thread-safe rate limiting functionality using a lock mechanism.
 */
export class RateLimitManager implements IRateLimitManager {
	private lastRequestTime: number | null = null
	private readonly lockKey: string
	private readonly lock: TaskStateLock

	constructor(lockKey: string = "rate_limit", lock?: TaskStateLock) {
		this.lockKey = lockKey
		this.lock = lock || new TaskStateLock()
	}

	/**
	 * Calculate the delay needed before the next request can be made
	 *
	 * @param rateLimitSeconds - The rate limit window in seconds
	 * @returns The delay in milliseconds to wait before the next request
	 */
	async calculateDelay(rateLimitSeconds: number): Promise<number> {
		return this.lock.withLock(this.lockKey, () => {
			if (!this.lastRequestTime) {
				return 0
			}

			const now = Date.now()
			const timeSinceLastRequest = now - this.lastRequestTime
			const delayMs = Math.max(0, rateLimitSeconds * 1000 - timeSinceLastRequest)
			return delayMs
		})
	}

	/**
	 * Update the timestamp of the last request
	 *
	 * @param timestamp - Optional timestamp to set (defaults to current time)
	 */
	async updateLastRequestTime(timestamp?: number): Promise<void> {
		await this.lock.withLock(this.lockKey, () => {
			this.lastRequestTime = timestamp ?? Date.now()
		})
	}

	/**
	 * Get the timestamp of the last request
	 *
	 * @returns The timestamp of the last request, or null if no requests have been made
	 */
	async getLastRequestTime(): Promise<number | null> {
		return this.lock.withLock(this.lockKey, () => {
			return this.lastRequestTime
		})
	}

	/**
	 * Reset the rate limit state
	 */
	reset(): void {
		// Reset is synchronous and doesn't need locking since it's a simple assignment
		this.lastRequestTime = null
	}

	/**
	 * Check if rate limiting is active
	 * @returns True if a previous request time exists
	 */
	async hasActiveRateLimit(): Promise<boolean> {
		return this.lock.withLock(this.lockKey, () => {
			return this.lastRequestTime !== null
		})
	}

	/**
	 * Calculate rate limit delay in seconds (for backward compatibility)
	 * @param rateLimitSeconds - Rate limit in seconds
	 * @returns Delay in seconds needed before next request
	 */
	async calculateRateLimitDelay(rateLimitSeconds: number): Promise<number> {
		const delayMs = await this.calculateDelay(rateLimitSeconds)
		return Math.ceil(delayMs / 1000)
	}
}
