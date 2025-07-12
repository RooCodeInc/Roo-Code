import { NoRetryStrategy } from "./NoRetryStrategy"
import { ErrorType } from "../../core/interfaces/types"

describe("NoRetryStrategy", () => {
	let strategy: NoRetryStrategy

	beforeEach(() => {
		strategy = new NoRetryStrategy()
	})

	describe("shouldRetry", () => {
		test("should always return false for any error type", () => {
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
				expect(strategy.shouldRetry(errorType, 0)).toBe(false)
				expect(strategy.shouldRetry(errorType, 1)).toBe(false)
				expect(strategy.shouldRetry(errorType, 5)).toBe(false)
			})
		})

		test("should return false for any attempt number", () => {
			const attempts = [0, 1, 2, 5, 10, 100, -1]

			attempts.forEach((attempt) => {
				expect(strategy.shouldRetry("THROTTLING", attempt)).toBe(false)
			})
		})
	})

	describe("calculateDelay", () => {
		test("should always return 0 for any error type", () => {
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
				expect(strategy.calculateDelay(errorType, 0)).toBe(0)
				expect(strategy.calculateDelay(errorType, 1)).toBe(0)
				expect(strategy.calculateDelay(errorType, 5)).toBe(0)
			})
		})

		test("should return 0 for any attempt number", () => {
			const attempts = [0, 1, 2, 5, 10, 100, -1]

			attempts.forEach((attempt) => {
				expect(strategy.calculateDelay("THROTTLING", attempt)).toBe(0)
			})
		})
	})

	describe("consistency", () => {
		test("shouldRetry and calculateDelay should be consistent", () => {
			// If shouldRetry returns false, calculateDelay should return 0
			const errorTypes: ErrorType[] = ["THROTTLING", "ACCESS_DENIED", "UNKNOWN"]
			const attempts = [0, 1, 5, 10]

			errorTypes.forEach((errorType) => {
				attempts.forEach((attempt) => {
					const shouldRetry = strategy.shouldRetry(errorType, attempt)
					const delay = strategy.calculateDelay(errorType, attempt)

					expect(shouldRetry).toBe(false)
					expect(delay).toBe(0)
				})
			})
		})
	})

	describe("interface compliance", () => {
		test("should implement IRetryStrategy interface correctly", () => {
			// Check that the strategy has the required methods
			expect(typeof strategy.shouldRetry).toBe("function")
			expect(typeof strategy.calculateDelay).toBe("function")

			// Check method signatures work correctly
			expect(() => strategy.shouldRetry("THROTTLING", 1)).not.toThrow()
			expect(() => strategy.calculateDelay("THROTTLING", 1)).not.toThrow()
		})
	})
})
