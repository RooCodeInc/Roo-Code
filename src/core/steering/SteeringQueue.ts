/**
 * SteeringQueue
 *
 * A simple queue for reactive steering advice. When the user sends steering
 * advice while the agent is actively working, it is enqueued here. At the
 * next API call the pending advice is drained, formatted, and injected into
 * the prompt so the LLM can naturally incorporate it.
 *
 * Design constraints:
 * - Zero overhead when no advice is pending (no extra tokens).
 * - Capped at MAX_PENDING to avoid unbounded growth.
 * - TTL-based expiration so stale advice doesn't pollute future calls.
 */

export interface SteeringAdvice {
	text: string
	timestamp: number
}

const MAX_PENDING = 5
const TTL_MS = 5 * 60 * 1000 // 5 minutes

export class SteeringQueue {
	private queue: SteeringAdvice[] = []

	/**
	 * Enqueue a piece of steering advice from the user.
	 * Drops the oldest item if the queue is at capacity.
	 */
	enqueue(text: string): void {
		if (!text.trim()) {
			return
		}

		if (this.queue.length >= MAX_PENDING) {
			this.queue.shift()
		}

		this.queue.push({ text: text.trim(), timestamp: Date.now() })
	}

	/**
	 * Drain all non-expired advice and format it as an injection block.
	 * Returns `undefined` when the queue is empty (zero-overhead path).
	 */
	drain(): string | undefined {
		if (this.queue.length === 0) {
			return undefined
		}

		const now = Date.now()
		const valid = this.queue.filter((a) => now - a.timestamp < TTL_MS)
		this.queue = []

		if (valid.length === 0) {
			return undefined
		}

		const lines = valid.map((a, i) => `${i + 1}. ${a.text}`).join("\n")

		return [
			"<steering_advice>",
			"The user has sent the following real-time steering advice while you were working.",
			"Please incorporate this guidance into your next actions. If any advice conflicts",
			"with your current approach, use your judgment to determine the best path forward.",
			"",
			lines,
			"</steering_advice>",
		].join("\n")
	}

	/**
	 * Whether the queue has any pending advice.
	 */
	get hasPending(): boolean {
		return this.queue.length > 0
	}

	/**
	 * Number of items currently in the queue.
	 */
	get size(): number {
		return this.queue.length
	}

	/**
	 * Clear all pending advice.
	 */
	clear(): void {
		this.queue = []
	}
}
