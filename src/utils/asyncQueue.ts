/**
 * AsyncQueue - A reusable queue with ready signal for async generators
 *
 * This utility provides a queue-based pattern for streaming data from
 * event-driven sources (like child processes) to async generators with
 * per-item timeout that resets when items are added or fetched.
 */

export interface AsyncQueueOptions<T> {
	/** Maximum number of items that can be in the queue at the same time (concurrency limit) */
	limit?: number
	/** Timeout in milliseconds per item (optional) */
	timeout?: number
	/** Callback called when timeout occurs (optional) */
	onTimeout?: () => void
}

export interface AsyncQueue<T> {
	/** Add an item to the queue and signal readiness. Waits if the queue is at capacity. */
	enqueue(item: T): Promise<void>
	/** Signal that an error occurred */
	error(error: Error): void
	/** Signal that the queue is complete (no more items will be added) */
	complete(): void
	/** Generator that yields items from the queue */
	[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown>
}

/**
 * Creates an async queue with ready signal pattern
 *
 * @param options - Configuration options for the queue
 * @returns An AsyncQueue object with enqueue, error, complete, and async iterator
 *
 * @example
 * ```typescript
 * const queue = createAsyncQueue<string>({ limit: 100, timeout: 10000 });
 *
 * // In event handlers:
 * process.stdout.on('data', (data) => {
 *   queue.enqueue(data.toString());
 * });
 *
 * process.on('error', (err) => {
 *   queue.error(new Error(`Process error: ${err.message}`));
 * });
 *
 * process.on('close', () => {
 *   queue.complete();
 * });
 *
 * // Consume from the queue:
 * for await (const item of queue) {
 *   console.log(item);
 * }
 * ```
 */
export function createAsyncQueue<T>(options: AsyncQueueOptions<T> = {}): AsyncQueue<T> {
	const { limit = Number.MAX_SAFE_INTEGER, timeout, onTimeout } = options

	let resumeCallback: (() => void) | null = null
	const queue: T[] = []
	let lastError: Error | null = null
	let isComplete = false
	let timeoutId: NodeJS.Timeout | null = null
	let dequeueCallbacks: Array<() => void> = []

	/**
	 * Reset the timeout timer
	 */
	function resetTimeout() {
		if (timeoutId) {
			clearTimeout(timeoutId)
			timeoutId = null
		}

		if (timeout && !isComplete) {
			timeoutId = setTimeout(() => {
				if (!isComplete) {
					onTimeout?.()
					resume()
				}
			}, timeout)
		}
	}

	/**
	 * Resume the generator if it's waiting
	 */
	function resume() {
		if (resumeCallback) {
			const cb = resumeCallback
			resumeCallback = null
			cb()
		}
	}

	/**
	 * Signal one waiting enqueue call that space is available
	 */
	function signalDequeue() {
		if (dequeueCallbacks.length > 0) {
			const cb = dequeueCallbacks.shift()!
			cb()
		}
	}

	/**
	 * Cleanup resources
	 */
	function cleanup() {
		if (timeoutId) {
			clearTimeout(timeoutId)
			timeoutId = null
		}
	}

	return {
		/**
		 * Add an item to the queue and signal readiness
		 * Waits if the queue is at capacity (limit reached)
		 * Resets the timeout when an item is added
		 */
		async enqueue(item: T) {
			if (isComplete) {
				return
			}

			// Don't enqueue if an error has been set
			if (lastError) {
				return
			}

			// Wait if the queue is at capacity
			while (queue.length >= limit) {
				await new Promise<void>((resolve) => {
					dequeueCallbacks.push(resolve)
				})
				// Check again after waking up in case state changed
				if (isComplete || lastError) {
					return
				}
			}

			queue.push(item)
			resetTimeout()
			resume()
		},

		/**
		 * Signal that an error occurred
		 * Errors are always stored and thrown, even after completion
		 */
		error(error: Error) {
			// Always store the error, even if already complete
			// This ensures errors are never silently swallowed
			if (!lastError) {
				lastError = error
				cleanup()
				resume()
				// Wake up any waiting enqueue calls
				while (dequeueCallbacks.length > 0) {
					const cb = dequeueCallbacks.shift()!
					cb()
				}
			}
		},

		/**
		 * Signal that the queue is complete
		 */
		complete() {
			if (isComplete) {
				return
			}
			isComplete = true
			cleanup()
			resume()
			// Wake up any waiting enqueue calls
			while (dequeueCallbacks.length > 0) {
				const cb = dequeueCallbacks.shift()!
				cb()
			}
		},

		/**
		 * Async iterator that yields items from the queue
		 * Resets the timeout when an item is fetched
		 */
		async *[Symbol.asyncIterator]() {
			while (!isComplete || queue.length > 0) {
				// If queue is empty and not complete, wait for items
				if (queue.length === 0 && !isComplete) {
					await new Promise<void>((resolve) => {
						resumeCallback = resolve
					})
					// Check for errors immediately after waking up
					if (lastError) {
						throw lastError
					}
				}

				// Yield items from the queue
				while (queue.length > 0) {
					const item = queue.shift()!
					// Signal waiting enqueue calls that space is available
					signalDequeue()
					// Reset timeout after yielding an item
					resetTimeout()
					yield item
				}

				// Check for errors after yielding items
				if (lastError) {
					throw lastError
				}
			}

			// Final error check after the loop to ensure errors are never silently swallowed
			// This handles the case where an error is set after the queue is complete
			if (lastError) {
				throw lastError
			}
		},
	}
}
