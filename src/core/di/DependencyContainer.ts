import { IRateLimitManager } from "../interfaces/IRateLimitManager"
import { RateLimitManager } from "../rate-limit/RateLimitManager"
import { TaskStateLock } from "../task/TaskStateLock"

/**
 * DependencyContainer - Manages dependency injection for the application
 *
 * This container provides a centralized place to register and resolve dependencies,
 * enabling better testability and decoupling of components.
 */
export class DependencyContainer {
	private static instance: DependencyContainer
	private services: Map<string, any> = new Map()
	private factories: Map<string, () => any> = new Map()

	private constructor() {}

	/**
	 * Get the singleton instance of the DependencyContainer
	 */
	static getInstance(): DependencyContainer {
		if (!DependencyContainer.instance) {
			DependencyContainer.instance = new DependencyContainer()
		}
		return DependencyContainer.instance
	}

	/**
	 * Register a singleton service
	 */
	register<T>(key: string, service: T): void {
		this.services.set(key, service)
	}

	/**
	 * Register a factory function for creating services
	 */
	registerFactory<T>(key: string, factory: () => T): void {
		this.factories.set(key, factory)
	}

	/**
	 * Resolve a service by key
	 */
	resolve<T>(key: string): T {
		// Check if we have a singleton instance
		if (this.services.has(key)) {
			return this.services.get(key) as T
		}

		// Check if we have a factory
		if (this.factories.has(key)) {
			const factory = this.factories.get(key)!
			const instance = factory()
			// Store as singleton for future use
			this.services.set(key, instance)
			return instance as T
		}

		throw new Error(`Service '${key}' not found in container`)
	}

	/**
	 * Create a new instance using a factory (doesn't store as singleton)
	 */
	create<T>(key: string): T {
		if (this.factories.has(key)) {
			const factory = this.factories.get(key)!
			return factory() as T
		}

		throw new Error(`Factory '${key}' not found in container`)
	}

	/**
	 * Clear all registered services and factories
	 */
	clear(): void {
		this.services.clear()
		this.factories.clear()
	}

	/**
	 * Reset the singleton instance (useful for testing)
	 */
	static reset(): void {
		DependencyContainer.instance = new DependencyContainer()
	}
}

// Service keys for type safety
export const ServiceKeys = {
	RATE_LIMIT_MANAGER: "RateLimitManager",
	TASK_STATE_LOCK: "TaskStateLock",
	GLOBAL_RATE_LIMIT_MANAGER: "GlobalRateLimitManager",
} as const

// Factory functions for creating configured instances
export function createRateLimitManager(): IRateLimitManager {
	return new RateLimitManager("global_rate_limit")
}

export function createTaskStateLock(): TaskStateLock {
	// This will be updated when we split TaskStateLock
	return new TaskStateLock()
}

// Initialize default services
export function initializeContainer(): void {
	const container = DependencyContainer.getInstance()

	// Register factories
	container.registerFactory(ServiceKeys.RATE_LIMIT_MANAGER, createRateLimitManager)
	container.registerFactory(ServiceKeys.TASK_STATE_LOCK, createTaskStateLock)

	// Register the global rate limit manager as a singleton
	container.register(ServiceKeys.GLOBAL_RATE_LIMIT_MANAGER, createRateLimitManager())
}
