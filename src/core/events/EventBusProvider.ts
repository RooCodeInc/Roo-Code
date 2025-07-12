import { EventBus } from "./EventBus"

/**
 * EventBusProvider manages EventBus instances for dependency injection.
 * It ensures that components can share EventBus instances when needed
 * or create isolated instances for testing.
 */
export class EventBusProvider {
	private static defaultInstance: EventBus | null = null
	private static testInstances: Map<string, EventBus> = new Map()

	/**
	 * Get the default EventBus instance (singleton for production use)
	 */
	static getDefault(): EventBus {
		if (!this.defaultInstance) {
			this.defaultInstance = new EventBus()
		}
		return this.defaultInstance!
	}

	/**
	 * Create a new isolated EventBus instance for testing
	 * @param testId - Unique identifier for the test instance
	 */
	static createTestInstance(testId: string): EventBus {
		const instance = new EventBus()
		this.testInstances.set(testId, instance)
		return instance
	}

	/**
	 * Get a test instance by ID
	 * @param testId - Unique identifier for the test instance
	 */
	static getTestInstance(testId: string): EventBus | undefined {
		return this.testInstances.get(testId)
	}

	/**
	 * Clear a specific test instance
	 * @param testId - Unique identifier for the test instance
	 */
	static clearTestInstance(testId: string): void {
		const instance = this.testInstances.get(testId)
		if (instance) {
			instance.removeAllListeners()
			this.testInstances.delete(testId)
		}
	}

	/**
	 * Clear all test instances
	 */
	static clearAllTestInstances(): void {
		this.testInstances.forEach((instance) => {
			instance.removeAllListeners()
		})
		this.testInstances.clear()
	}

	/**
	 * Reset the default instance (mainly for testing)
	 */
	static resetDefault(): void {
		if (this.defaultInstance) {
			this.defaultInstance.removeAllListeners()
			this.defaultInstance = null
		}
	}

	/**
	 * Get or create an EventBus instance based on context
	 * @param context - Optional context object that may contain test information
	 */
	static getInstance(context?: { testId?: string }): EventBus {
		if (context?.testId) {
			// In test context, return or create a test instance
			let instance = this.testInstances.get(context.testId)
			if (!instance) {
				instance = this.createTestInstance(context.testId)
			}
			return instance
		}
		// In production context, return the default singleton
		return this.getDefault()
	}
}
