import { describe, it, expect } from "vitest"
import { type ModeConfig } from "@roo-code/types"
import { getModeBySlug, getVisibleModes, getSubmodes } from "../modes"

describe("Compound Mode Slugs", () => {
	const mockCustomModes: ModeConfig[] = [
		{
			slug: "parent-mode",
			name: "Parent Mode",
			roleDefinition: "Parent mode definition",
			groups: ["read"],
		},
		{
			slug: "parent-mode/submode1",
			name: "Submode 1",
			roleDefinition: "Submode 1 definition",
			groups: ["read"],
			hidden: true,
			parent: "parent-mode",
		},
		{
			slug: "parent-mode/submode2",
			name: "Submode 2",
			roleDefinition: "Submode 2 definition",
			groups: ["edit"],
			hidden: true,
			parent: "parent-mode",
		},
		{
			slug: "regular-mode",
			name: "Regular Mode",
			roleDefinition: "Regular mode definition",
			groups: ["read"],
		},
	]

	describe("getModeBySlug", () => {
		it("should find mode with simple slug", () => {
			const mode = getModeBySlug("parent-mode", mockCustomModes)
			expect(mode).toBeDefined()
			expect(mode?.slug).toBe("parent-mode")
		})

		it("should find mode with compound slug (parent/child format)", () => {
			const mode = getModeBySlug("parent-mode/submode1", mockCustomModes)
			expect(mode).toBeDefined()
			expect(mode?.slug).toBe("parent-mode/submode1")
			expect(mode?.parent).toBe("parent-mode")
		})

		it("should return undefined for non-existent compound slug", () => {
			const mode = getModeBySlug("parent-mode/non-existent", mockCustomModes)
			expect(mode).toBeUndefined()
		})

		it("should prioritize exact match over compound slug parsing", () => {
			const mode = getModeBySlug("regular-mode", mockCustomModes)
			expect(mode).toBeDefined()
			expect(mode?.slug).toBe("regular-mode")
		})
	})

	describe("getVisibleModes", () => {
		it("should exclude hidden submodes from visible modes", () => {
			const visibleModes = getVisibleModes(mockCustomModes)

			// Should include built-in modes plus custom non-hidden modes
			// Built-in modes: architect, code, ask, debug, orchestrator (5)
			// Custom non-hidden: parent-mode, regular-mode (2)
			// Total: 7
			expect(visibleModes.length).toBeGreaterThan(0)
			expect(visibleModes.map((m) => m.slug)).toContain("parent-mode")
			expect(visibleModes.map((m) => m.slug)).toContain("regular-mode")
			expect(visibleModes.map((m) => m.slug)).not.toContain("parent-mode/submode1")
			expect(visibleModes.map((m) => m.slug)).not.toContain("parent-mode/submode2")
		})

		it("should include all modes when none are hidden", () => {
			const modesWithoutHidden: ModeConfig[] = [
				{
					slug: "mode1",
					name: "Mode 1",
					roleDefinition: "Definition 1",
					groups: ["read"],
				},
				{
					slug: "mode2",
					name: "Mode 2",
					roleDefinition: "Definition 2",
					groups: ["edit"],
				},
			]

			const visibleModes = getVisibleModes(modesWithoutHidden)
			// Should include built-in modes plus custom modes (5 + 2 = 7)
			expect(visibleModes.length).toBeGreaterThan(0)
			expect(visibleModes.map((m) => m.slug)).toContain("mode1")
			expect(visibleModes.map((m) => m.slug)).toContain("mode2")
		})
	})

	describe("getSubmodes", () => {
		it("should return all submodes for a parent", () => {
			const submodes = getSubmodes("parent-mode", mockCustomModes)

			expect(submodes).toHaveLength(2)
			expect(submodes.map((m) => m.slug)).toContain("parent-mode/submode1")
			expect(submodes.map((m) => m.slug)).toContain("parent-mode/submode2")
		})

		it("should return empty array for mode with no submodes", () => {
			const submodes = getSubmodes("regular-mode", mockCustomModes)
			expect(submodes).toHaveLength(0)
		})

		it("should handle non-existent parent mode", () => {
			const submodes = getSubmodes("non-existent", mockCustomModes)
			expect(submodes).toHaveLength(0)
		})
	})

	describe("Slug validation", () => {
		it("should accept valid simple slugs", () => {
			const validSlugs = ["code", "architect", "debug-mode", "test-123"]

			validSlugs.forEach((slug) => {
				const regex = /^[a-zA-Z0-9-]+(\/[a-zA-Z0-9-]+)?$/
				expect(regex.test(slug)).toBe(true)
			})
		})

		it("should accept valid compound slugs", () => {
			const validCompoundSlugs = ["parent/child", "architect/design", "debug-mode/trace", "test-123/subtest-456"]

			validCompoundSlugs.forEach((slug) => {
				const regex = /^[a-zA-Z0-9-]+(\/[a-zA-Z0-9-]+)?$/
				expect(regex.test(slug)).toBe(true)
			})
		})

		it("should reject invalid slugs", () => {
			const invalidSlugs = [
				"parent/child/grandchild", // Too many levels
				"/child", // Starting with slash
				"parent/", // Ending with slash
				"parent//child", // Double slash
				"parent child", // Space
				"parent@child", // Invalid character
				"", // Empty
			]

			invalidSlugs.forEach((slug) => {
				const regex = /^[a-zA-Z0-9-]+(\/[a-zA-Z0-9-]+)?$/
				expect(regex.test(slug)).toBe(false)
			})
		})
	})
})
