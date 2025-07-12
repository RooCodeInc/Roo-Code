import { EventEmitter } from "events"

/**
 * EventBus - Singleton event bus for decoupled communication between components
 *
 * This class provides a centralized event system to break circular dependencies
 * and enable loose coupling between Task and StreamStateManager.
 */
export class EventBus extends EventEmitter {
	private static instance: EventBus

	constructor() {
		super()
		// Set max listeners to a higher value to prevent warnings
		this.setMaxListeners(50)
	}

	/**
	 * Get the singleton instance of EventBus
	 */
	static getInstance(): EventBus {
		if (!EventBus.instance) {
			EventBus.instance = new EventBus()
		}
		return EventBus.instance
	}

	/**
	 * Reset the singleton instance (useful for testing)
	 * @internal
	 */
	static resetInstance(): void {
		if (EventBus.instance) {
			EventBus.instance.removeAllListeners()
			EventBus.instance = undefined as any
		}
	}

	/**
	 * Type-safe event emission
	 */
	emitEvent<T = any>(event: string, data?: T): boolean {
		return this.emit(event, data)
	}

	/**
	 * Type-safe event listener registration
	 */
	onEvent<T = any>(event: string, listener: (data: T) => void): this {
		return this.on(event, listener)
	}

	/**
	 * Type-safe one-time event listener registration
	 */
	onceEvent<T = any>(event: string, listener: (data: T) => void): this {
		return this.once(event, listener)
	}

	/**
	 * Type-safe event listener removal
	 */
	offEvent<T = any>(event: string, listener: (data: T) => void): this {
		return this.off(event, listener)
	}
}
