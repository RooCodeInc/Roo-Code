import { LinearBackoffStrategy } from "./LinearBackoffStrategy"
import { ErrorType } from "../../core/interfaces/types"

describe("LinearBackoffStrategy", () => {
	let strategy: LinearBackoffStrategy

	beforeEach(() => {
		strategy = new LinearBackoffStrategy()
	})

	describe("shouldRetry", () => {
		test("should return true for retryable error types within max attempts", () => {
			const result = strategy.shouldRetry("THROTTLING", 2)
			expect(result).toBe(true)
		})

		test("should return false for non-retryable error types", () => {
			const result = strategy.shouldRetry("ACCESS_DENIED", 1)
			expect(result).toBe(false)
		})

		test("should return false when max attempts exceeded", () => {
			const result = strategy.shouldRetry("THROTTLING", 5) // Default max is 5
			expect(result).toBe(false)
		})

		test("should return true at exactly max attempts", () => {
			const result = strategy.shouldRetry("THROTTLING", 4) // attempt 4 < max 5
			expect(result).toBe(true)
		})

		test("should handle all retryable error types", () => {
			const retryableTypes: ErrorType[] = [
				"THROTTLING",
				"RATE_LIMITED",
				"SERVICE_UNAVAILABLE",
				"TIMEOUT",
				"NETWORK_ERROR",
				"QUOTA_EXCEEDED",
				"GENERIC",
			]

			retryableTypes.forEach((errorType) => {
				expect(strategy.shouldRetry(errorType, 1)).toBe(true)
			})
		})

		test("should reject non-retryable error types", () => {
			const nonRetryableTypes: ErrorType[] = ["ACCESS_DENIED", "NOT_FOUND", "INVALID_REQUEST", "UNKNOWN"]

			nonRetryableTypes.forEach((errorType) => {
				expect(strategy.shouldRetry(errorType, 1)).toBe(false)
			})
		})
	})

	describe("calculateDelay", () => {
		test("should calculate linear backoff correctly", () => {
			const delay0 = strategy.calculateDelay("THROTTLING", 0)
			const delay1 = strategy.calculateDelay("THROTTLING", 1)
			const delay2 = strategy.calculateDelay("THROTTLING", 2)
			const delay3 = strategy.calculateDelay("THROTTLING", 3)

			// Base delay is 3 seconds, increment is 2 seconds:
			// Attempt 0: 3 + (0 * 2) = 3
			// Attempt 1: 3 + (1 * 2) = 5
			// Attempt 2: 3 + (2 * 2) = 7
			// Attempt 3: 3 + (3 * 2) = 9
			expect(delay0).toBe(3)
			expect(delay1).toBe(5)
			expect(delay2).toBe(7)
			expect(delay3).toBe(9)
		})

		test("should respect maximum delay cap", () => {
			const strategy = new LinearBackoffStrategy({
				baseDelay: 1,
				increment: 5,
				maxDelay: 15,
				maxRetries: 10,
			})

			const delay = strategy.calculateDelay("THROTTLING", 10)
			expect(delay).toBeLessThanOrEqual(15)
		})

		test("should return 0 for non-retryable errors", () => {
			const delay = strategy.calculateDelay("ACCESS_DENIED", 1)
			expect(delay).toBe(0)
		})

		test("should return 0 when max attempts exceeded", () => {
			const delay = strategy.calculateDelay("THROTTLING", 6) // > max attempts
			expect(delay).toBe(0)
		})

		test("should adjust delay based on error type", () => {
			// Service unavailable gets 1.3x multiplier
			const serviceDelay = strategy.calculateDelay("SERVICE_UNAVAILABLE", 0)
			const standardDelay = strategy.calculateDelay("THROTTLING", 0)
			expect(serviceDelay).toBeCloseTo(standardDelay * 1.3)

			// Quota exceeded gets 1.5x multiplier
			const quotaDelay = strategy.calculateDelay("QUOTA_EXCEEDED", 0)
			expect(quotaDelay).toBeCloseTo(standardDelay * 1.5)

			// Network errors get 0.7x multiplier
			const networkDelay = strategy.calculateDelay("NETWORK_ERROR", 0)
			expect(networkDelay).toBeCloseTo(standardDelay * 0.7)
		})

		test("should maintain linear progression with error type adjustments", () => {
			// Test that linear progression is maintained even with error type adjustments
			const delay0 = strategy.calculateDelay("SERVICE_UNAVAILABLE", 0)
			const delay1 = strategy.calculateDelay("SERVICE_UNAVAILABLE", 1)

			// Both should have the same 1.3x multiplier applied
			const baseDelay0 = 3 // baseDelay + (0 * increment)
			const baseDelay1 = 5 // baseDelay + (1 * increment)

			expect(delay0).toBeCloseTo(baseDelay0 * 1.3)
			expect(delay1).toBeCloseTo(baseDelay1 * 1.3)
		})
	})

	describe("custom configuration", () => {
		test("should use custom base delay", () => {
			const strategy = new LinearBackoffStrategy({ baseDelay: 10 })
			const delay = strategy.calculateDelay("THROTTLING", 0)
			expect(delay).toBe(10)
		})

		test("should use custom increment", () => {
			const strategy = new LinearBackoffStrategy({
				baseDelay: 2,
				increment: 5,
			})

			const delay0 = strategy.calculateDelay("THROTTLING", 0)
			const delay1 = strategy.calculateDelay("THROTTLING", 1)
			const delay2 = strategy.calculateDelay("THROTTLING", 2)

			expect(delay0).toBe(2) // 2 + (0 * 5)
			expect(delay1).toBe(7) // 2 + (1 * 5)
			expect(delay2).toBe(12) // 2 + (2 * 5)
		})

		test("should use custom max attempts", () => {
			const strategy = new LinearBackoffStrategy({ maxRetries: 2 })

			expect(strategy.shouldRetry("THROTTLING", 0)).toBe(true)
			expect(strategy.shouldRetry("THROTTLING", 1)).toBe(true)
			expect(strategy.shouldRetry("THROTTLING", 2)).toBe(false)
		})

		test("should use custom max delay", () => {
			const strategy = new LinearBackoffStrategy({
				baseDelay: 5,
				increment: 10,
				maxDelay: 20,
			})

			const delay0 = strategy.calculateDelay("THROTTLING", 0) // 5
			const delay1 = strategy.calculateDelay("THROTTLING", 1) // 15
			const delay2 = strategy.calculateDelay("THROTTLING", 2) // Should be capped at 20

			expect(delay0).toBe(5)
			expect(delay1).toBe(15)
			expect(delay2).toBe(20) // Capped at maxDelay
		})

		test("should use custom retryable types", () => {
			const strategy = new LinearBackoffStrategy({
				retryableTypes: ["THROTTLING", "NETWORK_ERROR"],
			})

			expect(strategy.shouldRetry("THROTTLING", 1)).toBe(true)
			expect(strategy.shouldRetry("NETWORK_ERROR", 1)).toBe(true)
			expect(strategy.shouldRetry("RATE_LIMITED", 1)).toBe(false) // Not in custom list
		})
	})

	describe("getConfig", () => {
		test("should return configuration object", () => {
			const config = strategy.getConfig()

			expect(config.baseDelay).toBe(3)
			expect(config.increment).toBe(2)
			expect(config.maxDelay).toBe(300)
			expect(config.maxRetries).toBe(5)
			expect(config.retryableTypes).toContain("THROTTLING")
		})

		test("should return copy of config (not reference)", () => {
			const config1 = strategy.getConfig()
			const config2 = strategy.getConfig()

			expect(config1).not.toBe(config2) // Different objects
			expect(config1).toEqual(config2) // Same content
		})
	})

	describe("linear vs exponential comparison", () => {
		test("should have more predictable delay progression than exponential", () => {
			const delays: number[] = []

			// Calculate first 4 delays
			for (let i = 0; i < 4; i++) {
				delays.push(strategy.calculateDelay("THROTTLING", i))
			}

			// Linear progression should have constant differences
			const diff1 = delays[1] - delays[0] // 5 - 3 = 2
			const diff2 = delays[2] - delays[1] // 7 - 5 = 2
			const diff3 = delays[3] - delays[2] // 9 - 7 = 2

			expect(diff1).toBe(2) // Same as increment
			expect(diff2).toBe(2) // Same as increment
			expect(diff3).toBe(2) // Same as increment
		})

		test("should be more conservative than exponential for higher attempts", () => {
			// Create both strategies with same base parameters
			const linearStrategy = new LinearBackoffStrategy({ baseDelay: 2, increment: 2 })

			// At higher attempts, linear should be much smaller than exponential
			const linearDelay = linearStrategy.calculateDelay("THROTTLING", 4)

			// Linear: 2 + (4 * 2) = 10
			// Exponential would be: 2 * 2^4 = 32
			expect(linearDelay).toBe(10)
			expect(linearDelay).toBeLessThan(32) // Much less than exponential would be
		})
	})

	describe("edge cases", () => {
		test("should handle attempt 0 correctly", () => {
			const delay = strategy.calculateDelay("THROTTLING", 0)
			expect(delay).toBe(3) // Should be base delay
		})

		test("should handle negative attempt numbers", () => {
			// The implementation doesn't explicitly handle negative numbers,
			// but the formula should handle it: baseDelay + (attempt * increment)
			const delay = strategy.calculateDelay("THROTTLING", -1)
			// 3 + (-1 * 2) = 1
			expect(delay).toBe(1)
		})

		test("should handle zero increment", () => {
			const strategy = new LinearBackoffStrategy({
				baseDelay: 5,
				increment: 0,
			})

			// All delays should be the same (base delay)
			expect(strategy.calculateDelay("THROTTLING", 0)).toBe(5)
			expect(strategy.calculateDelay("THROTTLING", 1)).toBe(5)
			expect(strategy.calculateDelay("THROTTLING", 2)).toBe(5)
		})

		test("should handle very large attempt numbers with max delay cap", () => {
			const strategy = new LinearBackoffStrategy({
				baseDelay: 1,
				increment: 100,
				maxDelay: 60,
				maxRetries: 100,
			})
			const delay = strategy.calculateDelay("THROTTLING", 50)
			expect(delay).toBeLessThanOrEqual(60) // Should be capped at max delay
		})
	})
})
