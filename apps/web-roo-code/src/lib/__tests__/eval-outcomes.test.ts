import { describe, it, expect } from "vitest"
import { EVAL_OUTCOMES, isEvalOutcomeId, getEvalOutcomeBySlug } from "../eval-outcomes"

describe("EVAL_OUTCOMES", () => {
	it("contains at least one outcome", () => {
		expect(EVAL_OUTCOMES.length).toBeGreaterThan(0)
	})

	it("every outcome has a unique id", () => {
		const ids = EVAL_OUTCOMES.map((o) => o.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it("every outcome has a unique slug", () => {
		const slugs = EVAL_OUTCOMES.map((o) => o.slug)
		expect(new Set(slugs).size).toBe(slugs.length)
	})

	it("every outcome has required fields", () => {
		for (const outcome of EVAL_OUTCOMES) {
			expect(outcome.id).toBeTruthy()
			expect(outcome.slug).toBeTruthy()
			expect(outcome.name).toBeTruthy()
			expect(outcome.description).toBeTruthy()
			expect(outcome.icon).toBeDefined()
			expect(outcome.recommendedRoleIds.length).toBeGreaterThan(0)
			expect(outcome.whyItWorks.length).toBeGreaterThan(0)
		}
	})

	it("builderProfile, when present, has required fields", () => {
		const withProfiles = EVAL_OUTCOMES.filter((o) => o.builderProfile)
		expect(withProfiles.length).toBeGreaterThan(0)

		for (const outcome of withProfiles) {
			const profile = outcome.builderProfile!
			expect(profile.title).toBeTruthy()
			expect(profile.description).toBeTruthy()
			expect(profile.capabilities.length).toBeGreaterThan(0)
			expect(profile.howItWorks.length).toBeGreaterThan(0)
		}
	})
})

describe("isEvalOutcomeId", () => {
	it("returns true for valid outcome ids", () => {
		for (const outcome of EVAL_OUTCOMES) {
			expect(isEvalOutcomeId(outcome.id)).toBe(true)
		}
	})

	it("returns false for invalid ids", () => {
		expect(isEvalOutcomeId("nonexistent")).toBe(false)
		expect(isEvalOutcomeId("")).toBe(false)
		expect(isEvalOutcomeId("PROTOTYPE_TO_PR")).toBe(false)
	})
})

describe("getEvalOutcomeBySlug", () => {
	it("returns the correct outcome for valid slugs", () => {
		for (const outcome of EVAL_OUTCOMES) {
			const result = getEvalOutcomeBySlug(outcome.slug)
			expect(result).toBeDefined()
			expect(result!.id).toBe(outcome.id)
			expect(result!.slug).toBe(outcome.slug)
		}
	})

	it("returns undefined for invalid slugs", () => {
		expect(getEvalOutcomeBySlug("nonexistent")).toBeUndefined()
		expect(getEvalOutcomeBySlug("")).toBeUndefined()
	})
})
