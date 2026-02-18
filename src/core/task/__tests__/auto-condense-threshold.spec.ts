// npx vitest src/core/task/__tests__/auto-condense-threshold.spec.ts

import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "@siid-code/types"
import { MIN_CONDENSE_THRESHOLD, MAX_CONDENSE_THRESHOLD } from "../../condense"

/**
 * Test suite for the auto-condense threshold calculation logic
 *
 * This tests the new automatic condensing behavior where condenseContext()
 * is called when the context usage exceeds a configurable threshold.
 */
describe("Auto-Condense Threshold Logic", () => {
	/**
	 * Helper function to calculate context percentage
	 * Mirrors the logic in Task.ts
	 */
	const calculateContextPercentage = (
		totalTokens: number,
		contextWindow: number,
		maxTokens?: number | null,
	): number => {
		const effectiveMaxTokens = maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS
		const availableTokens = contextWindow - effectiveMaxTokens
		return (totalTokens / availableTokens) * 100
	}

	/**
	 * Helper function to determine the effective threshold
	 * Mirrors the logic in Task.ts
	 */
	const getEffectiveThreshold = (
		autoCondenseContextPercent: number,
		profileThresholds: Record<string, number>,
		currentProfileId: string,
	): number => {
		const profileThreshold = profileThresholds[currentProfileId]
		const threshold =
			profileThreshold !== undefined && profileThreshold !== -1 ? profileThreshold : autoCondenseContextPercent
		return Math.max(MIN_CONDENSE_THRESHOLD, Math.min(threshold, MAX_CONDENSE_THRESHOLD))
	}

	describe("Context Percentage Calculation", () => {
		it("should calculate context percentage correctly with default max tokens", () => {
			const contextWindow = 200000
			const totalTokens = 100000
			// availableTokens = 200000 - 8192 (ANTHROPIC_DEFAULT_MAX_TOKENS) = 191808
			// percentage = (100000 / 191808) * 100 ≈ 52.13%
			const percentage = calculateContextPercentage(totalTokens, contextWindow, null)
			expect(percentage).toBeCloseTo(52.13, 1)
		})

		it("should calculate context percentage correctly with custom max tokens", () => {
			const contextWindow = 200000
			const totalTokens = 100000
			const maxTokens = 50000
			// availableTokens = 200000 - 50000 = 150000
			// percentage = (100000 / 150000) * 100 = 66.67%
			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBeCloseTo(66.67, 1)
		})

		it("should handle small context windows", () => {
			const contextWindow = 50000
			const totalTokens = 30000
			const maxTokens = 10000
			// availableTokens = 50000 - 10000 = 40000
			// percentage = (30000 / 40000) * 100 = 75%
			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(75)
		})

		it("should handle large context windows", () => {
			const contextWindow = 1000000
			const totalTokens = 400000
			const maxTokens = 100000
			// availableTokens = 1000000 - 100000 = 900000
			// percentage = (400000 / 900000) * 100 ≈ 44.44%
			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBeCloseTo(44.44, 1)
		})
	})

	describe("Threshold Selection Logic", () => {
		it("should use global threshold when no profile threshold is set", () => {
			const autoCondenseContextPercent = 80
			const profileThresholds = {}
			const currentProfileId = "default"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(80)
		})

		it("should use profile-specific threshold when set", () => {
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"profile-1": 60,
			}
			const currentProfileId = "profile-1"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(60)
		})

		it("should fall back to global threshold when profile threshold is -1", () => {
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"profile-1": -1,
			}
			const currentProfileId = "profile-1"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(80)
		})

		it("should fall back to global threshold when profile has no specific setting", () => {
			const autoCondenseContextPercent = 75
			const profileThresholds = {
				"profile-1": 50,
			}
			const currentProfileId = "profile-2" // Different profile

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(75)
		})

		it("should clamp threshold to minimum (5%)", () => {
			const autoCondenseContextPercent = 3 // Below min
			const profileThresholds = {}
			const currentProfileId = "default"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(MIN_CONDENSE_THRESHOLD) // 5
		})

		it("should clamp threshold to maximum (100%)", () => {
			const autoCondenseContextPercent = 150 // Above max
			const profileThresholds = {}
			const currentProfileId = "default"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(MAX_CONDENSE_THRESHOLD) // 100
		})

		it("should clamp profile-specific threshold to minimum", () => {
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"profile-1": 2, // Below min
			}
			const currentProfileId = "profile-1"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(MIN_CONDENSE_THRESHOLD) // 5
		})

		it("should clamp profile-specific threshold to maximum", () => {
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"profile-1": 120, // Above max
			}
			const currentProfileId = "profile-1"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(MAX_CONDENSE_THRESHOLD) // 100
		})
	})

	describe("Threshold Decision Logic", () => {
		/**
		 * Test that condensing should trigger when percentage >= threshold
		 */
		it("should trigger condense when context usage exactly equals threshold", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 105000 // (105000 / 150000) * 100 = 70%
			const threshold = 70

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(70)
			expect(percentage >= threshold).toBe(true) // Should condense
		})

		it("should trigger condense when context usage exceeds threshold", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 120000 // (120000 / 150000) * 100 = 80%
			const threshold = 70

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(80)
			expect(percentage >= threshold).toBe(true) // Should condense
		})

		it("should not trigger condense when context usage is below threshold", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 90000 // (90000 / 150000) * 100 = 60%
			const threshold = 70

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(60)
			expect(percentage >= threshold).toBe(false) // Should NOT condense
		})

		it("should handle edge case: 100% threshold (never trigger automatically)", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 149999 // (149999 / 150000) * 100 ≈ 99.999%
			const threshold = 100

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBeCloseTo(99.999, 2)
			expect(percentage >= threshold).toBe(false) // Should NOT condense (below 100%)
		})

		it("should handle edge case: 5% threshold (trigger very early)", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 7500 // (7500 / 150000) * 100 = 5%
			const threshold = MIN_CONDENSE_THRESHOLD // 5%

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(5)
			expect(percentage >= threshold).toBe(true) // Should condense
		})

		it("should handle very small token usage", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 1000 // (1000 / 150000) * 100 ≈ 0.67%
			const threshold = 50

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBeCloseTo(0.67, 2)
			expect(percentage >= threshold).toBe(false) // Should NOT condense
		})
	})

	describe("Integration Scenarios", () => {
		/**
		 * Test realistic scenarios combining all logic
		 */
		it("should correctly decide for scenario: default profile, 80% global threshold, 75% usage", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 112500 // (112500 / 150000) * 100 = 75%
			const autoCondenseContextPercent = 80
			const profileThresholds = {}
			const currentProfileId = "default"

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)

			expect(percentage).toBe(75)
			expect(threshold).toBe(80)
			expect(percentage >= threshold).toBe(false) // Should NOT condense
		})

		it("should correctly decide for scenario: profile with 60% threshold, 65% usage", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 97500 // (97500 / 150000) * 100 = 65%
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"low-threshold-profile": 60,
			}
			const currentProfileId = "low-threshold-profile"

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)

			expect(percentage).toBe(65)
			expect(threshold).toBe(60)
			expect(percentage >= threshold).toBe(true) // Should condense
		})

		it("should correctly decide for scenario: profile with -1 (use global), 85% usage", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 127500 // (127500 / 150000) * 100 = 85%
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"use-global-profile": -1,
			}
			const currentProfileId = "use-global-profile"

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)

			expect(percentage).toBe(85)
			expect(threshold).toBe(80) // Uses global since profile is -1
			expect(percentage >= threshold).toBe(true) // Should condense
		})

		it("should handle scenario with very large context window and tokens", () => {
			const contextWindow = 1000000
			const maxTokens = 100000
			const totalTokens = 720000 // (720000 / 900000) * 100 = 80%
			const autoCondenseContextPercent = 75
			const profileThresholds = {}
			const currentProfileId = "default"

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)

			expect(percentage).toBe(80)
			expect(threshold).toBe(75)
			expect(percentage >= threshold).toBe(true) // Should condense
		})

		it("should handle multiple profiles with different thresholds correctly", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 97500 // (97500 / 150000) * 100 = 65%
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"profile-a": 50,
				"profile-b": 70,
				"profile-c": 90,
			}

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(65)

			// Profile A: 50% threshold -> should condense (65% >= 50%)
			const thresholdA = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, "profile-a")
			expect(thresholdA).toBe(50)
			expect(percentage >= thresholdA).toBe(true)

			// Profile B: 70% threshold -> should NOT condense (65% < 70%)
			const thresholdB = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, "profile-b")
			expect(thresholdB).toBe(70)
			expect(percentage >= thresholdB).toBe(false)

			// Profile C: 90% threshold -> should NOT condense (65% < 90%)
			const thresholdC = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, "profile-c")
			expect(thresholdC).toBe(90)
			expect(percentage >= thresholdC).toBe(false)

			// Profile D (not configured): uses global 80% -> should NOT condense (65% < 80%)
			const thresholdD = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, "profile-d")
			expect(thresholdD).toBe(80)
			expect(percentage >= thresholdD).toBe(false)
		})
	})

	describe("Edge Cases and Boundary Conditions", () => {
		it("should handle zero tokens correctly", () => {
			const contextWindow = 200000
			const maxTokens = 50000
			const totalTokens = 0
			const threshold = 50

			const percentage = calculateContextPercentage(totalTokens, contextWindow, maxTokens)
			expect(percentage).toBe(0)
			expect(percentage >= threshold).toBe(false)
		})

		it("should handle context window equal to max tokens", () => {
			const contextWindow = 50000
			const maxTokens = 50000
			const totalTokens = 100 // Any tokens would be infinity %

			// availableTokens = 0, which would cause division by zero in real implementation
			// In practice, this scenario shouldn't happen, but we test the math
			const availableTokens = contextWindow - maxTokens
			expect(availableTokens).toBe(0)
			// Would result in Infinity or NaN - this is an edge case that should be handled in prod code
		})

		it("should handle negative profile threshold (undefined behavior)", () => {
			const autoCondenseContextPercent = 80
			const profileThresholds = {
				"profile-1": -5, // Negative but not -1
			}
			const currentProfileId = "profile-1"

			// The logic treats ANY non -1 value as valid, so it would use -5
			// But then clamp it to MIN_CONDENSE_THRESHOLD (5)
			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(MIN_CONDENSE_THRESHOLD) // 5 (clamped)
		})

		it("should handle threshold at boundary: exactly 5%", () => {
			const autoCondenseContextPercent = 5
			const profileThresholds = {}
			const currentProfileId = "default"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(5)
		})

		it("should handle threshold at boundary: exactly 100%", () => {
			const autoCondenseContextPercent = 100
			const profileThresholds = {}
			const currentProfileId = "default"

			const threshold = getEffectiveThreshold(autoCondenseContextPercent, profileThresholds, currentProfileId)
			expect(threshold).toBe(100)
		})
	})
})
