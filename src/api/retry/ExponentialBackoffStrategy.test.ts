import { ExponentialBackoffStrategy } from "./ExponentialBackoffStrategy"
import { ErrorType } from "../../core/interfaces/types"

describe("ExponentialBackoffStrategy", () => {
	let strategy: ExponentialBackoffStrategy

	beforeEach(() => {
		strategy = new ExponentialBackoffStrategy()
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
		test("should calculate exponential backoff correctly", () => {
			const delay0 = strategy.calculateDelay("THROTTLING", 0)
			const delay1 = strategy.calculateDelay("THROTTLING", 1)
			const delay2 = strategy.calculateDelay("THROTTLING", 2)

			// Base delay is 5 seconds, multiplier is 2:
			// Attempt 0: 5 (base delay)
			// Attempt 1: 5 * 2^1 = 10
			// Attempt 2: 5 * 2^2 = 20
			expect(delay0).toBe(5)
			expect(delay1).toBe(10)
			expect(delay2).toBe(20)
		})

		test("should respect maximum delay cap", () => {
			const strategy = new ExponentialBackoffStrategy({
				baseDelay: 1,
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
			// Service unavailable gets 1.5x multiplier
			const serviceDelay = strategy.calculateDelay("SERVICE_UNAVAILABLE", 0)
			const standardDelay = strategy.calculateDelay("THROTTLING", 0)
			expect(serviceDelay).toBeGreaterThan(standardDelay)

			// Quota exceeded gets 2x multiplier
			const quotaDelay = strategy.calculateDelay("QUOTA_EXCEEDED", 0)
			expect(quotaDelay).toBeGreaterThan(serviceDelay)

			// Network errors get 0.5x multiplier
			const networkDelay = strategy.calculateDelay("NETWORK_ERROR", 0)
			expect(networkDelay).toBeLessThan(standardDelay)
		})
	})

	describe("custom configuration", () => {
		test("should use custom base delay", () => {
			const strategy = new ExponentialBackoffStrategy({ baseDelay: 3 })
			const delay = strategy.calculateDelay("THROTTLING", 0)
			expect(delay).toBe(3)
		})

		test("should use custom max attempts", () => {
			const strategy = new ExponentialBackoffStrategy({ maxRetries: 2 })

			expect(strategy.shouldRetry("THROTTLING", 0)).toBe(true)
			expect(strategy.shouldRetry("THROTTLING", 1)).toBe(true)
			expect(strategy.shouldRetry("THROTTLING", 2)).toBe(false)
		})

		test("should use custom multiplier", () => {
			const strategy = new ExponentialBackoffStrategy({
				baseDelay: 2,
				multiplier: 3,
			})

			const delay0 = strategy.calculateDelay("THROTTLING", 0)
			const delay1 = strategy.calculateDelay("THROTTLING", 1)

			expect(delay0).toBe(2)
			expect(delay1).toBe(6) // 2 * 3^1
		})

		test("should use custom retryable types", () => {
			const strategy = new ExponentialBackoffStrategy({
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

			expect(config.baseDelay).toBe(5)
			expect(config.maxDelay).toBe(600)
			expect(config.maxRetries).toBe(5)
			expect(config.multiplier).toBe(2)
			expect(config.retryableTypes).toContain("THROTTLING")
		})

		test("should return copy of config (not reference)", () => {
			const config1 = strategy.getConfig()
			const config2 = strategy.getConfig()

			expect(config1).not.toBe(config2) // Different objects
			expect(config1).toEqual(config2) // Same content
		})
	})

	describe("edge cases", () => {
		test("should handle attempt 0 correctly", () => {
			const delay = strategy.calculateDelay("THROTTLING", 0)
			expect(delay).toBe(5) // Should be base delay
		})

		test("should handle negative attempt numbers", () => {
			// The implementation doesn't explicitly handle negative numbers,
			// but Math.pow should handle it gracefully
			const delay = strategy.calculateDelay("THROTTLING", -1)
			expect(delay).toBeGreaterThanOrEqual(0)
		})

		test("should handle very large attempt numbers", () => {
			const strategy = new ExponentialBackoffStrategy({
				baseDelay: 1,
				maxDelay: 60,
				maxRetries: 100,
			})
			const delay = strategy.calculateDelay("THROTTLING", 50)
			expect(delay).toBeLessThanOrEqual(60) // Should be capped at max delay
		})
	})
})
