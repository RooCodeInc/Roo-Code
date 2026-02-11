/**
 * SelfCleaningPromiseHolder
 *
 * A utility class that manages a collection of promises with automatic cleanup.
 * When a promise is added, it is tracked and automatically removed from the collection
 * when it completes (whether resolved or rejected) using a .finally() handler.
 *
 * This pattern is useful for tracking active asynchronous operations without
 * manual cleanup, preventing memory leaks from accumulating completed promises.
 *
 * @template T - The type of value the promises resolve to
 */
export class SelfCleaningPromiseHolder<T = unknown> {
	private readonly promises = new Set<Promise<T>>()

	/**
	 * Adds a promise to the holder and sets up automatic cleanup.
	 * The promise will be automatically removed from the holder when it completes.
	 *
	 * @param promise - The promise to track
	 */
	public add(promise: Promise<T>): void {
		this.promises.add(promise)

		// Automatically remove the promise when it completes
		promise.finally(() => {
			this.promises.delete(promise)
		})
	}

	/**
	 * Waits for all currently active promises to complete.
	 * Note: This waits for promises that are active at the time of calling.
	 * Promises added after this method is called will not be waited for.
	 *
	 * @returns A promise that resolves when all active promises complete
	 */
	public async waitForAll(): Promise<void> {
		// Create a snapshot of current promises to avoid race conditions
		const activePromises = Array.from(this.promises)
		await Promise.all(activePromises)
	}

	/**
	 * Waits for at least one active promise to complete.
	 * Returns immediately if there are no active promises.
	 *
	 * @returns A promise that resolves when at least one promise completes
	 */
	public async waitForOne(): Promise<void> {
		const activePromises = Array.from(this.promises)
		if (activePromises.length === 0) {
			return
		}
		await Promise.race(activePromises)
	}

	/**
	 * Gets the current count of active promises.
	 *
	 * @returns The number of promises currently being tracked
	 */
	public get size(): number {
		return this.promises.size
	}
}
