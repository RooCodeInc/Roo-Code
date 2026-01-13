/**
 * DeltaTracker - Utility for computing text deltas
 *
 * Tracks what portion of text content has been sent and returns only
 * the new (delta) portion on subsequent calls. This ensures streaming
 * content is sent incrementally without duplication.
 *
 * @example
 * ```ts
 * const tracker = new DeltaTracker()
 *
 * tracker.getDelta("msg1", "Hello") // returns "Hello"
 * tracker.getDelta("msg1", "Hello World") // returns " World"
 * tracker.getDelta("msg1", "Hello World!") // returns "!"
 *
 * tracker.reset() // Clear all tracking for new prompt
 * ```
 */
export class DeltaTracker {
	private positions: Map<string | number, number> = new Map()

	/**
	 * Get the delta (new portion) of text that hasn't been sent yet.
	 * Automatically updates internal tracking when there's new content.
	 *
	 * @param id - Unique identifier for the content stream (e.g., message timestamp)
	 * @param fullText - The full accumulated text so far
	 * @returns The new portion of text (delta), or empty string if nothing new
	 */
	getDelta(id: string | number, fullText: string): string {
		const lastPos = this.positions.get(id) ?? 0
		const delta = fullText.slice(lastPos)

		if (delta.length > 0) {
			this.positions.set(id, fullText.length)
		}

		return delta
	}

	/**
	 * Check if there would be a delta without updating tracking.
	 * Useful for conditional logic without side effects.
	 */
	peekDelta(id: string | number, fullText: string): string {
		const lastPos = this.positions.get(id) ?? 0
		return fullText.slice(lastPos)
	}

	/**
	 * Reset all tracking. Call when starting a new prompt/session.
	 */
	reset(): void {
		this.positions.clear()
	}

	/**
	 * Reset tracking for a specific ID only.
	 */
	resetId(id: string | number): void {
		this.positions.delete(id)
	}

	/**
	 * Get the current tracked position for an ID.
	 * Returns 0 if not tracked.
	 */
	getPosition(id: string | number): number {
		return this.positions.get(id) ?? 0
	}
}
