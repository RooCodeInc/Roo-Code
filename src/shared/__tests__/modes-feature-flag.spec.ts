import { describe, it, expect } from "vitest"
import { getDefaultModeFromFeatureFlag, DEFAULT_MODE_FEATURE_FLAG, modes } from "../modes"

describe("Default Mode Feature Flag", () => {
	describe("DEFAULT_MODE_FEATURE_FLAG", () => {
		it("should have the correct feature flag key", () => {
			expect(DEFAULT_MODE_FEATURE_FLAG).toBe("default-mode-experiment")
		})
	})

	describe("getDefaultModeFromFeatureFlag", () => {
		it("should return 'code' mode when feature flag is undefined", () => {
			const result = getDefaultModeFromFeatureFlag(undefined)
			expect(result).toBe("code")
			expect(result).toBe(modes[1].slug)
		})

		it("should return 'code' mode when feature flag is null", () => {
			const result = getDefaultModeFromFeatureFlag(null as any)
			expect(result).toBe("code")
		})

		it("should return 'architect' mode when feature flag is the string 'architect'", () => {
			const result = getDefaultModeFromFeatureFlag("architect")
			expect(result).toBe("architect")
			expect(result).toBe(modes[0].slug)
		})

		it("should return 'architect' mode when feature flag is the string 'ARCHITECT' (case insensitive)", () => {
			const result = getDefaultModeFromFeatureFlag("ARCHITECT")
			expect(result).toBe("architect")
		})

		it("should return 'code' mode when feature flag is the string 'code'", () => {
			const result = getDefaultModeFromFeatureFlag("code")
			expect(result).toBe("code")
		})

		it("should return 'code' mode when feature flag is an unknown string", () => {
			const result = getDefaultModeFromFeatureFlag("unknown-mode")
			expect(result).toBe("code")
		})

		it("should return 'architect' mode when feature flag is true (experiment variant)", () => {
			const result = getDefaultModeFromFeatureFlag(true)
			expect(result).toBe("architect")
		})

		it("should return 'code' mode when feature flag is false (control variant)", () => {
			const result = getDefaultModeFromFeatureFlag(false)
			expect(result).toBe("code")
		})
	})
})
