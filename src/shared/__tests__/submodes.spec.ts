import { describe, it, expect } from "vitest"
import type { ModeConfig } from "@roo-code/types"

import {
	getSubmodes,
	isSubmode,
	getCompoundSlug,
	parseCompoundSlug,
	getModeByCompoundSlug,
	getAllModes,
	getVisibleModes,
	getAllModesForConfiguration,
} from "../modes"

describe("Submode functionality", () => {
	const parentMode: ModeConfig = {
		slug: "architect",
		name: "Architect",
		roleDefinition: "Parent mode",
		groups: ["read"],
	}

	const submode1: ModeConfig = {
		slug: "planner",
		name: "Planner",
		roleDefinition: "Planning submode",
		groups: ["read"],
		parent: "architect",
		hidden: true,
	}

	const submode2: ModeConfig = {
		slug: "designer",
		name: "Designer",
		roleDefinition: "Design submode",
		groups: ["read", "edit"],
		parent: "architect",
		hidden: true,
	}

	const visibleSubmode: ModeConfig = {
		slug: "reviewer",
		name: "Reviewer",
		roleDefinition: "Review submode",
		groups: ["read"],
		parent: "architect",
		hidden: false,
	}

	const customModes = [parentMode, submode1, submode2, visibleSubmode]

	describe("getSubmodes", () => {
		it("should return all submodes for a parent", () => {
			const submodes = getSubmodes("architect", customModes)
			expect(submodes).toHaveLength(3)
			expect(submodes).toContainEqual(submode1)
			expect(submodes).toContainEqual(submode2)
			expect(submodes).toContainEqual(visibleSubmode)
		})

		it("should return empty array for mode with no submodes", () => {
			const submodes = getSubmodes("code", customModes)
			expect(submodes).toHaveLength(0)
		})
	})

	describe("isSubmode", () => {
		it("should return true for submodes", () => {
			expect(isSubmode(submode1)).toBe(true)
			expect(isSubmode(submode2)).toBe(true)
		})

		it("should return false for parent modes", () => {
			expect(isSubmode(parentMode)).toBe(false)
		})
	})

	describe("getCompoundSlug", () => {
		it("should return compound slug for submodes", () => {
			expect(getCompoundSlug(submode1)).toBe("architect/planner")
			expect(getCompoundSlug(submode2)).toBe("architect/designer")
		})

		it("should return simple slug for parent modes", () => {
			expect(getCompoundSlug(parentMode)).toBe("architect")
		})
	})

	describe("parseCompoundSlug", () => {
		it("should parse compound slugs correctly", () => {
			expect(parseCompoundSlug("architect/planner")).toEqual({
				parent: "architect",
				child: "planner",
			})
		})

		it("should parse simple slugs correctly", () => {
			expect(parseCompoundSlug("architect")).toEqual({
				child: "architect",
			})
		})
	})

	describe("getModeByCompoundSlug", () => {
		it("should find submode by compound slug", () => {
			const mode = getModeByCompoundSlug("architect/planner", customModes)
			expect(mode).toEqual(submode1)
		})

		it("should find parent mode by simple slug", () => {
			const mode = getModeByCompoundSlug("architect", customModes)
			expect(mode).toEqual(parentMode)
		})

		it("should return undefined for non-existent compound slug", () => {
			const mode = getModeByCompoundSlug("architect/nonexistent", customModes)
			expect(mode).toBeUndefined()
		})
	})

	describe("getAllModes", () => {
		it("should exclude hidden modes by default", () => {
			const modes = getAllModes(customModes)
			expect(modes).toContain(parentMode)
			expect(modes).toContain(visibleSubmode)
			expect(modes).not.toContain(submode1)
			expect(modes).not.toContain(submode2)
		})

		it("should include hidden modes when requested", () => {
			const modes = getAllModes(customModes, true)
			expect(modes).toContain(parentMode)
			expect(modes).toContain(visibleSubmode)
			expect(modes).toContain(submode1)
			expect(modes).toContain(submode2)
		})
	})

	describe("getVisibleModes", () => {
		it("should only return visible modes", () => {
			const modes = getVisibleModes(customModes)
			expect(modes).toContain(parentMode)
			expect(modes).toContain(visibleSubmode)
			expect(modes).not.toContain(submode1)
			expect(modes).not.toContain(submode2)
		})
	})

	describe("getAllModesForConfiguration", () => {
		it("should include all modes with compound slugs for submodes", () => {
			const modes = getAllModesForConfiguration(customModes)

			// Should include all modes (including hidden)
			// We have 4 custom modes + 5 built-in modes = 9, but architect appears in both
			// so we expect 8 total (architect from custom overrides the built-in)
			expect(modes).toHaveLength(8)

			// Find the transformed submodes
			const transformedPlanner = modes.find((m) => m.slug === "architect/planner")
			const transformedDesigner = modes.find((m) => m.slug === "architect/designer")
			const transformedReviewer = modes.find((m) => m.slug === "architect/reviewer")

			// Check compound slugs are created
			expect(transformedPlanner).toBeDefined()
			expect(transformedDesigner).toBeDefined()
			expect(transformedReviewer).toBeDefined()

			// Check names show hierarchy
			expect(transformedPlanner?.name).toBe("architect › Planner")
			expect(transformedDesigner?.name).toBe("architect › Designer")
			expect(transformedReviewer?.name).toBe("architect › Reviewer")
		})
	})
})
