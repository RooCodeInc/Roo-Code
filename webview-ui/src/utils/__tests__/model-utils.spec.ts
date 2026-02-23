// npx vitest src/utils/__tests__/model-utils.spec.ts

import { calculateTokenDistribution } from "../model-utils"

describe("calculateTokenDistribution", () => {
	it("should calculate token distribution correctly", () => {
		const contextWindow = 10000
		const contextTokens = 5000
		const maxTokens = 2000

		const result = calculateTokenDistribution(contextWindow, contextTokens, maxTokens)

		expect(result.reservedForOutput).toBe(maxTokens)
		expect(result.availableSize).toBe(3000) // 10000 - 5000 - 2000

		// Percentages are based on contextWindow
		// currentPercent = 5000/10000 * 100 = 50%
		// effectivePercent = 5000/(10000-2000) * 100 = 62.5%
		// reservedPercent = 2000/10000 * 100 = 20%
		// availablePercent = 3000/10000 * 100 = 30%
		expect(result.currentPercent).toBeCloseTo(50)
		expect(result.effectivePercent).toBeCloseTo(62.5)
		expect(result.reservedPercent).toBeCloseTo(20)
		expect(result.availablePercent).toBeCloseTo(30)
		expect(Math.round(result.currentPercent + result.reservedPercent + result.availablePercent)).toBe(100)
	})

	it("should default to 8192 when maxTokens not provided", () => {
		const contextWindow = 20000
		const contextTokens = 5000

		const result = calculateTokenDistribution(contextWindow, contextTokens)

		expect(result.reservedForOutput).toBe(8192)
		expect(result.availableSize).toBe(6808) // 20000 - 5000 - 8192
	})

	it("should handle negative or zero inputs by using positive fallbacks", () => {
		const result = calculateTokenDistribution(-1000, -500)

		// With negative contextWindow (becomes 0), all percentages are 0
		expect(result.currentPercent).toBe(0)
		expect(result.effectivePercent).toBe(0)
		expect(result.reservedPercent).toBe(0)
		expect(result.availablePercent).toBe(0)
		expect(result.reservedForOutput).toBe(8192) // Uses ANTHROPIC_DEFAULT_MAX_TOKENS
		expect(result.availableSize).toBe(0) // max(0, 0 - 0 - 8192) = 0
	})

	it("should handle zero context window without division by zero errors", () => {
		const result = calculateTokenDistribution(0, 0)

		// When contextWindow is 0, all percentages should be 0 (safeguard against division by zero)
		expect(result.currentPercent).toBe(0)
		expect(result.effectivePercent).toBe(0)
		expect(result.reservedPercent).toBe(0)
		expect(result.availablePercent).toBe(0)
		expect(result.reservedForOutput).toBe(8192) // Uses ANTHROPIC_DEFAULT_MAX_TOKENS when no maxTokens provided
		expect(result.availableSize).toBe(0)
	})
})
