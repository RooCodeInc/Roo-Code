/**
 * Circuit Breaker - Prevents infinite loops from repeated failures
 * Halts execution after consecutive tool failures
 */

export class CircuitBreaker {
	private consecutiveFailures: number = 0
	private readonly maxFailures: number
	private readonly resetTimeoutMs: number
	private lastFailureTime: number = 0
	private resetTimer: NodeJS.Timeout | null = null

	constructor(maxFailures: number = 3, resetTimeoutMs: number = 60000) {
		this.maxFailures = maxFailures
		this.resetTimeoutMs = resetTimeoutMs
	}

	/**
	 * Record a tool execution failure
	 * @returns Object indicating if circuit is open and error message
	 */
	recordFailure(): { circuitOpen: boolean; error?: string } {
		this.consecutiveFailures++
		this.lastFailureTime = Date.now()

		// Clear existing reset timer
		if (this.resetTimer) {
			clearTimeout(this.resetTimer)
		}

		// Set new reset timer
		this.resetTimer = setTimeout(() => {
			this.reset()
		}, this.resetTimeoutMs)

		if (this.consecutiveFailures >= this.maxFailures) {
			return {
				circuitOpen: true,
				error: `Circuit Breaker Activated: ${this.consecutiveFailures} consecutive tool failures detected.\n\nThe agent appears to be stuck in a failure loop. Execution has been halted to prevent infinite retries.\n\nPossible causes:\n- Invalid tool parameters\n- Scope violations\n- File access issues\n- Logic errors in agent reasoning\n\nPlease review the recent errors and adjust your approach. The circuit breaker will automatically reset after ${this.resetTimeoutMs / 1000} seconds of inactivity.`,
			}
		}

		return { circuitOpen: false }
	}

	/**
	 * Record a successful tool execution (resets counter)
	 */
	recordSuccess(): void {
		this.reset()
	}

	/**
	 * Reset the circuit breaker
	 */
	reset(): void {
		this.consecutiveFailures = 0
		this.lastFailureTime = 0
		if (this.resetTimer) {
			clearTimeout(this.resetTimer)
			this.resetTimer = null
		}
	}

	/**
	 * Check if circuit is currently open
	 * @returns true if circuit is open (too many failures)
	 */
	isOpen(): boolean {
		return this.consecutiveFailures >= this.maxFailures
	}

	/**
	 * Get current failure count
	 * @returns Number of consecutive failures
	 */
	getFailureCount(): number {
		return this.consecutiveFailures
	}

	/**
	 * Get time since last failure in milliseconds
	 * @returns Milliseconds since last failure, or 0 if no failures
	 */
	getTimeSinceLastFailure(): number {
		if (this.lastFailureTime === 0) {
			return 0
		}
		return Date.now() - this.lastFailureTime
	}
}
