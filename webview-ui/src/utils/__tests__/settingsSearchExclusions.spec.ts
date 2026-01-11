import { describe, it, expect } from "vitest"

import { getExclusionReason, shouldExcludeFromSearch } from "../settingsSearchExclusions"

describe("settingsSearchExclusions", () => {
	describe("shouldExcludeFromSearch", () => {
		it("excludes modelInfo display fields", () => {
			expect(shouldExcludeFromSearch("modelInfo.inputPrice")).toBe(true)
			expect(shouldExcludeFromSearch("modelInfo.outputPrice")).toBe(true)
			expect(shouldExcludeFromSearch("modelInfo.contextWindow")).toBe(true)
		})

		it("excludes validation messages", () => {
			expect(shouldExcludeFromSearch("validation.apiKey")).toBe(true)
			expect(shouldExcludeFromSearch("validation.modelId")).toBe(true)
		})

		it("excludes placeholders", () => {
			expect(shouldExcludeFromSearch("placeholders.apiKey")).toBe(true)
			expect(shouldExcludeFromSearch("placeholders.baseUrl")).toBe(true)
		})

		it("excludes custom model pricing", () => {
			expect(shouldExcludeFromSearch("providers.customModel.pricing.input")).toBe(true)
			expect(shouldExcludeFromSearch("providers.customModel.pricing.output")).toBe(true)
		})

		it("excludes service tier display-only entries", () => {
			expect(shouldExcludeFromSearch("serviceTier.columns.tier")).toBe(true)
			expect(shouldExcludeFromSearch("serviceTier.pricingTableTitle")).toBe(true)
		})

		it("does not exclude actionable settings", () => {
			expect(shouldExcludeFromSearch("browser.enable")).toBe(false)
			expect(shouldExcludeFromSearch("providers.apiProvider")).toBe(false)
			expect(shouldExcludeFromSearch("terminal.outputLineLimit")).toBe(false)
		})

		it("does not exclude settings that merely contain keywords", () => {
			expect(shouldExcludeFromSearch("providers.enablePromptCaching")).toBe(false)
		})
	})

	describe("getExclusionReason", () => {
		it("returns reason for excluded ids", () => {
			const reason = getExclusionReason("modelInfo.inputPrice")
			expect(reason).toBeDefined()
			expect(reason?.length).toBeGreaterThan(0)
		})

		it("returns undefined for included ids", () => {
			expect(getExclusionReason("browser.enable")).toBeUndefined()
		})
	})
})
