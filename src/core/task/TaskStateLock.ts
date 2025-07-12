/**
 * TaskStateLock - Provides atomic locking mechanisms for critical shared state
 *
 * This class prevents race conditions in shared state access during API retry cycles
 * by implementing a promise-based locking system that ensures sequential access to
 * critical resources.
 */
export class TaskStateLock {
	private readonly locks = new Map<string, Promise<void>>()
	private static instance: TaskStateLock

	// Static methods for backward compatibility
	static async acquire(lockKey: string): Promise<() => void> {
		if (!TaskStateLock.instance) {
			TaskStateLock.instance = new TaskStateLock()
		}
		return TaskStateLock.instance.acquire(lockKey)
	}

	static tryAcquire(lockKey: string): (() => void) | null {
		if (!TaskStateLock.instance) {
			TaskStateLock.instance = new TaskStateLock()
		}
		return TaskStateLock.instance.tryAcquire(lockKey)
	}

	static async withLock<T>(lockKey: string, fn: () => Promise<T> | T): Promise<T> {
		if (!TaskStateLock.instance) {
			TaskStateLock.instance = new TaskStateLock()
		}
		return TaskStateLock.instance.withLock(lockKey, fn)
	}

	static isLocked(lockKey: string): boolean {
		if (!TaskStateLock.instance) {
			TaskStateLock.instance = new TaskStateLock()
		}
		return TaskStateLock.instance.isLocked(lockKey)
	}

	static clearAllLocks(): void {
		if (!TaskStateLock.instance) {
			TaskStateLock.instance = new TaskStateLock()
		}
		TaskStateLock.instance.clearAllLocks()
	}

	/**
	 * Acquire an exclusive lock for the given key
	 * @param lockKey - Unique identifier for the resource being locked
	 * @returns Promise that resolves to a release function
	 */
	async acquire(lockKey: string): Promise<() => void> {
		// Wait for existing lock to be released
		while (this.locks.has(lockKey)) {
			await this.locks.get(lockKey)
		}

		// Create new lock
		let releaseLock: () => void
		const lockPromise = new Promise<void>((resolve) => {
			releaseLock = resolve
		})

		this.locks.set(lockKey, lockPromise)

		return () => {
			this.locks.delete(lockKey)
			releaseLock!()
		}
	}

	/**
	 * Try to acquire a lock without waiting
	 * @param lockKey - Unique identifier for the resource being locked
	 * @returns Release function if lock acquired, null if lock unavailable
	 */
	tryAcquire(lockKey: string): (() => void) | null {
		if (this.locks.has(lockKey)) {
			return null // Lock not available
		}

		let releaseLock: () => void
		const lockPromise = new Promise<void>((resolve) => {
			releaseLock = resolve
		})

		this.locks.set(lockKey, lockPromise)

		return () => {
			this.locks.delete(lockKey)
			releaseLock!()
		}
	}

	/**
	 * Execute a function with an exclusive lock
	 * @param lockKey - Unique identifier for the resource being locked
	 * @param fn - Function to execute while holding the lock
	 * @returns Promise resolving to the function's return value
	 */
	async withLock<T>(lockKey: string, fn: () => Promise<T> | T): Promise<T> {
		const release = await this.acquire(lockKey)
		try {
			return await fn()
		} finally {
			release()
		}
	}

	/**
	 * Check if a lock is currently active
	 * @param lockKey - Unique identifier for the resource
	 * @returns True if lock is active, false otherwise
	 */
	isLocked(lockKey: string): boolean {
		return this.locks.has(lockKey)
	}

	/**
	 * Clear all locks (for testing purposes)
	 * @internal
	 */
	clearAllLocks(): void {
		for (const [lockKey, lockPromise] of this.locks) {
			// Resolve all pending locks to prevent deadlocks
			lockPromise.then(() => {}).catch(() => {})
		}
		this.locks.clear()
	}
}

// Export the singleton instance for those who need it
export const taskStateLock = new TaskStateLock()

/**
 * GlobalRateLimitManager - Manages atomic access to global rate limiting state
 *
 * @deprecated Use DependencyContainer.getInstance().resolve(ServiceKeys.GLOBAL_RATE_LIMIT_MANAGER) instead
 *
 * This class is kept for backward compatibility but will be removed in a future version.
 * New code should use dependency injection to get the rate limit manager.
 */
export class GlobalRateLimitManager {
	private static lastApiRequestTime?: number
	private static readonly LOCK_KEY = "global_rate_limit"

	/**
	 * @deprecated Use IRateLimitManager.updateLastRequestTime() instead
	 */
	static async updateLastRequestTime(): Promise<number> {
		return taskStateLock.withLock(GlobalRateLimitManager.LOCK_KEY, () => {
			const now = Date.now()
			GlobalRateLimitManager.lastApiRequestTime = now
			return now
		})
	}

	/**
	 * @deprecated Use IRateLimitManager.getLastRequestTime() instead
	 */
	static async getLastRequestTime(): Promise<number | undefined> {
		return taskStateLock.withLock(GlobalRateLimitManager.LOCK_KEY, () => {
			return GlobalRateLimitManager.lastApiRequestTime
		})
	}

	/**
	 * @deprecated Use IRateLimitManager.calculateRateLimitDelay() instead
	 */
	static async calculateRateLimitDelay(rateLimitSeconds: number): Promise<number> {
		return taskStateLock.withLock(GlobalRateLimitManager.LOCK_KEY, () => {
			if (!GlobalRateLimitManager.lastApiRequestTime) {
				return 0
			}

			const now = Date.now()
			const timeSinceLastRequest = now - GlobalRateLimitManager.lastApiRequestTime
			return Math.ceil(Math.max(0, rateLimitSeconds * 1000 - timeSinceLastRequest) / 1000)
		})
	}

	/**
	 * @deprecated Use IRateLimitManager.reset() instead
	 */
	static reset(): void {
		GlobalRateLimitManager.lastApiRequestTime = undefined
	}

	/**
	 * @deprecated Use IRateLimitManager.hasActiveRateLimit() instead
	 */
	static async hasActiveRateLimit(): Promise<boolean> {
		return taskStateLock.withLock(GlobalRateLimitManager.LOCK_KEY, () => {
			return GlobalRateLimitManager.lastApiRequestTime !== undefined
		})
	}
}
