import { RetryStrategyFactory, RetryStrategyType } from "./RetryStrategyFactory"
import { ErrorType, ErrorContext } from "../../core/interfaces/types"
import { ExponentialBackoffStrategy } from "./ExponentialBackoffStrategy"
import { LinearBackoffStrategy } from "./LinearBackoffStrategy"
import { NoRetryStrategy } from "./NoRetryStrategy"

describe("RetryStrategyFactory", () => {
	let factory: RetryStrategyFactory

	beforeEach(() => {
		factory = new RetryStrategyFactory()
	})

	describe("constructor and configuration", () => {
		test("should create factory with default configuration", () => {
			const config = factory.getConfig()

			expect(config.defaultStrategy).toBe("exponential")
			expect(config.useProviderDelays).toBe(true)
			expect(config.errorTypeStrategies["ACCESS_DENIED"]).toBe("none")
			expect(config.errorTypeStrategies["QUOTA_EXCEEDED"]).toBe("linear")
			expect(config.errorTypeStrategies["THROTTLING"]).toBe("exponential")
		})

		test("should accept custom configuration", () => {
			const customFactory = new RetryStrategyFactory({
				defaultStrategy: "linear",
				useProviderDelays: false,
				errorTypeStrategies: {
					THROTTLING: "none",
					ACCESS_DENIED: "exponential",
				},
			})

			const config = customFactory.getConfig()
			expect(config.defaultStrategy).toBe("linear")
			expect(config.useProviderDelays).toBe(false)
			expect(config.errorTypeStrategies["THROTTLING"]).toBe("none")
			expect(config.errorTypeStrategies["ACCESS_DENIED"]).toBe("exponential")
		})

		test("should merge custom configuration with defaults", () => {
			const customFactory = new RetryStrategyFactory({
				defaultStrategy: "linear",
				// Only override some error type strategies
				errorTypeStrategies: {
					THROTTLING: "none",
				},
			})

			const config = customFactory.getConfig()
			expect(config.defaultStrategy).toBe("linear")
			expect(config.errorTypeStrategies["THROTTLING"]).toBe("none")
			// Should still have default for other error types
			expect(config.errorTypeStrategies["ACCESS_DENIED"]).toBe("none")
		})
	})

	describe("createStrategy", () => {
		test("should create appropriate strategy for error types with specific mappings", () => {
			// Test error types with specific strategy mappings
			const accessDeniedStrategy = factory.createStrategy("ACCESS_DENIED")
			expect(accessDeniedStrategy).toBeInstanceOf(NoRetryStrategy)

			const quotaStrategy = factory.createStrategy("QUOTA_EXCEEDED")
			expect(quotaStrategy).toBeInstanceOf(LinearBackoffStrategy)

			const throttlingStrategy = factory.createStrategy("THROTTLING")
			expect(throttlingStrategy).toBeInstanceOf(ExponentialBackoffStrategy)
		})

		test("should fall back to default strategy for unmapped error types", () => {
			const unknownStrategy = factory.createStrategy("UNKNOWN")
			expect(unknownStrategy).toBeInstanceOf(ExponentialBackoffStrategy) // Default is exponential
		})

		test("should consider context for strategy selection", () => {
			const context: ErrorContext = {
				isStreaming: true,
				provider: "test-provider",
				modelId: "test-model",
				retryAttempt: 1,
			}

			// Streaming context should prefer exponential for throttling
			const throttlingStrategy = factory.createStrategy("THROTTLING", context)
			expect(throttlingStrategy).toBeInstanceOf(ExponentialBackoffStrategy)

			const rateLimitedStrategy = factory.createStrategy("RATE_LIMITED", context)
			expect(rateLimitedStrategy).toBeInstanceOf(ExponentialBackoffStrategy)
		})

		test("should switch strategy based on high retry attempts", () => {
			const highRetryContext: ErrorContext = {
				isStreaming: false,
				provider: "test-provider",
				modelId: "test-model",
				retryAttempt: 4, // >= 3
			}

			// Should switch to linear for persistent service issues
			const serviceStrategy = factory.createStrategy("SERVICE_UNAVAILABLE", highRetryContext)
			expect(serviceStrategy).toBeInstanceOf(LinearBackoffStrategy)
		})

		test("should return same strategy instance for same strategy type", () => {
			const strategy1 = factory.createStrategy("THROTTLING")
			const strategy2 = factory.createStrategy("RATE_LIMITED")

			// Both should return the same exponential strategy instance
			expect(strategy1).toBe(strategy2)
		})
	})

	describe("createProviderAwareStrategy", () => {
		test("should use provider delay when available and enabled", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING", 30)

			// Should get a special provider delay strategy
			expect(strategy.calculateDelay("THROTTLING", 0)).toBe(30)
		})

		test("should fall back to regular strategy when provider delay not available", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING")

			// Should be the regular exponential strategy
			expect(strategy).toBeInstanceOf(ExponentialBackoffStrategy)
		})

		test("should fall back when provider delays disabled", () => {
			const customFactory = new RetryStrategyFactory({
				useProviderDelays: false,
			})

			const strategy = customFactory.createProviderAwareStrategy("THROTTLING", 30)

			// Should ignore provider delay and use regular strategy
			expect(strategy).toBeInstanceOf(ExponentialBackoffStrategy)
		})

		test("should ignore zero or negative provider delays", () => {
			const strategy1 = factory.createProviderAwareStrategy("THROTTLING", 0)
			const strategy2 = factory.createProviderAwareStrategy("THROTTLING", -5)

			expect(strategy1).toBeInstanceOf(ExponentialBackoffStrategy)
			expect(strategy2).toBeInstanceOf(ExponentialBackoffStrategy)
		})
	})

	describe("getAvailableStrategies", () => {
		test("should return all available strategy types", () => {
			const strategies = factory.getAvailableStrategies()

			expect(strategies).toContain("exponential")
			expect(strategies).toContain("linear")
			expect(strategies).toContain("none")
			expect(strategies).toHaveLength(3)
		})
	})

	describe("error handling and edge cases", () => {
		test("should handle invalid strategy type gracefully", () => {
			// Force invalid strategy mapping
			const customFactory = new RetryStrategyFactory({
				defaultStrategy: "invalid" as RetryStrategyType,
			})

			// Should fall back to exponential strategy
			const strategy = customFactory.createStrategy("THROTTLING")
			expect(strategy).toBeInstanceOf(ExponentialBackoffStrategy)
		})

		test("should handle missing context gracefully", () => {
			expect(() => factory.createStrategy("THROTTLING", undefined)).not.toThrow()
			expect(() => factory.createStrategy("THROTTLING")).not.toThrow()
		})

		test("should handle all error types", () => {
			const errorTypes: ErrorType[] = [
				"THROTTLING",
				"RATE_LIMITED",
				"SERVICE_UNAVAILABLE",
				"TIMEOUT",
				"NETWORK_ERROR",
				"QUOTA_EXCEEDED",
				"ACCESS_DENIED",
				"NOT_FOUND",
				"INVALID_REQUEST",
				"GENERIC",
				"UNKNOWN",
			]

			errorTypes.forEach((errorType) => {
				expect(() => factory.createStrategy(errorType)).not.toThrow()
			})
		})
	})

	describe("ProviderDelayStrategy behavior", () => {
		test("should respect provider delay for first attempt", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING", 15)

			expect(strategy.calculateDelay("THROTTLING", 0)).toBe(15)
		})

		test("should fallback to exponential for subsequent attempts", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING", 10)

			const delay1 = strategy.calculateDelay("THROTTLING", 1)
			const delay2 = strategy.calculateDelay("THROTTLING", 2)

			// Should use exponential backoff: max(10, 5) * 2^attempt
			expect(delay1).toBe(20) // 10 * 2^1
			expect(delay2).toBe(40) // 10 * 2^2
		})

		test("should respect max attempts for provider delay strategy", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING", 10)

			expect(strategy.shouldRetry("THROTTLING", 0)).toBe(true)
			expect(strategy.shouldRetry("THROTTLING", 2)).toBe(true)
			expect(strategy.shouldRetry("THROTTLING", 3)).toBe(false) // >= 3
		})

		test("should only retry certain error types with provider delays", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING", 10)

			// Should retry these types
			expect(strategy.shouldRetry("THROTTLING", 1)).toBe(true)
			expect(strategy.shouldRetry("RATE_LIMITED", 1)).toBe(true)
			expect(strategy.shouldRetry("SERVICE_UNAVAILABLE", 1)).toBe(true)
			expect(strategy.shouldRetry("QUOTA_EXCEEDED", 1)).toBe(true)

			// Should not retry these types
			expect(strategy.shouldRetry("ACCESS_DENIED", 1)).toBe(false)
			expect(strategy.shouldRetry("NOT_FOUND", 1)).toBe(false)
		})

		test("should cap exponential fallback at max delay", () => {
			const strategy = factory.createProviderAwareStrategy("THROTTLING", 5)

			// Should cap at 600 seconds
			const delay = strategy.calculateDelay("THROTTLING", 10)
			expect(delay).toBeLessThanOrEqual(600)
		})
	})

	describe("configuration consistency", () => {
		test("should maintain configuration immutability", () => {
			const config1 = factory.getConfig()
			const config2 = factory.getConfig()

			expect(config1).not.toBe(config2) // Different objects
			expect(config1).toEqual(config2) // Same content

			// Modifying returned config should not affect factory
			config1.defaultStrategy = "linear"
			expect(factory.getConfig().defaultStrategy).toBe("exponential")
		})

		test("should handle strategy configuration propagation", () => {
			const customFactory = new RetryStrategyFactory({
				exponentialConfig: {
					baseDelay: 10,
					maxRetries: 3,
				},
				linearConfig: {
					baseDelay: 5,
					increment: 3,
				},
			})

			const exponentialStrategy = customFactory.createStrategy("THROTTLING") as ExponentialBackoffStrategy
			const linearStrategy = customFactory.createStrategy("QUOTA_EXCEEDED") as LinearBackoffStrategy

			// Check that custom configurations were applied
			expect(exponentialStrategy.getConfig().baseDelay).toBe(10)
			expect(exponentialStrategy.getConfig().maxRetries).toBe(3)
			expect(linearStrategy.getConfig().baseDelay).toBe(5)
			expect(linearStrategy.getConfig().increment).toBe(3)
		})
	})

	describe("integration scenarios", () => {
		test("should handle streaming context with high retry attempts", () => {
			const context: ErrorContext = {
				isStreaming: true,
				provider: "test-provider",
				modelId: "test-model",
				retryAttempt: 4,
			}

			// Even with streaming context, high retry attempts should override
			const strategy = factory.createStrategy("SERVICE_UNAVAILABLE", context)
			expect(strategy).toBeInstanceOf(LinearBackoffStrategy)
		})

		test("should handle multiple strategy creation calls efficiently", () => {
			const strategies: any[] = []

			// Create many strategies
			for (let i = 0; i < 100; i++) {
				strategies.push(factory.createStrategy("THROTTLING"))
			}

			// All should be the same instance (efficient)
			const firstStrategy = strategies[0]
			strategies.forEach((strategy) => {
				expect(strategy).toBe(firstStrategy)
			})
		})
	})
})
