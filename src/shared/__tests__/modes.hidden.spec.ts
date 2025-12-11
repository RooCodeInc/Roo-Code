import { describe, it, expect } from "vitest"
import { type ModeConfig } from "@roo-code/types"
import { getAllModes, getModeBySlug } from "../modes"

describe("Hidden Modes", () => {
	const customModes: ModeConfig[] = [
		{
			slug: "parent-mode",
			name: "Parent Mode",
			roleDefinition: "Parent mode role",
			groups: ["read", "edit"],
		},
		{
			slug: "hidden-submode",
			name: "Hidden Submode",
			roleDefinition: "Hidden submode role",
			groups: ["read"],
			hidden: true,
			parent: "parent-mode",
		},
		{
			slug: "visible-mode",
			name: "Visible Mode",
			roleDefinition: "Visible mode role",
			groups: ["read"],
		},
	]

	describe("getAllModes", () => {
		it("should exclude hidden modes by default", () => {
			const modes = getAllModes(customModes)
			const slugs = modes.map((m) => m.slug)

			expect(slugs).toContain("parent-mode")
			expect(slugs).toContain("visible-mode")
			expect(slugs).not.toContain("hidden-submode")
		})

		it("should include hidden modes when includeHidden is true", () => {
			const modes = getAllModes(customModes, true)
			const slugs = modes.map((m) => m.slug)

			expect(slugs).toContain("parent-mode")
			expect(slugs).toContain("visible-mode")
			expect(slugs).toContain("hidden-submode")
		})

		it("should return all built-in modes when no custom modes provided", () => {
			const modes = getAllModes()
			expect(modes.length).toBeGreaterThan(0)
			expect(modes.every((m) => !m.hidden)).toBe(true)
		})

		it("should override built-in modes with custom modes of same slug", () => {
			const customWithOverride: ModeConfig[] = [
				{
					slug: "code",
					name: "Custom Code Mode",
					roleDefinition: "Custom code role",
					groups: ["read"],
				},
			]

			const modes = getAllModes(customWithOverride)
			const codeMode = modes.find((m) => m.slug === "code")

			expect(codeMode?.name).toBe("Custom Code Mode")
		})
	})

	describe("getModeBySlug", () => {
		it("should find hidden modes", () => {
			const mode = getModeBySlug("hidden-submode", customModes)
			expect(mode).toBeDefined()
			expect(mode?.hidden).toBe(true)
			expect(mode?.parent).toBe("parent-mode")
		})

		it("should find visible modes", () => {
			const mode = getModeBySlug("parent-mode", customModes)
			expect(mode).toBeDefined()
			expect(mode?.hidden).toBeUndefined()
		})

		it("should return undefined for non-existent mode", () => {
			const mode = getModeBySlug("non-existent", customModes)
			expect(mode).toBeUndefined()
		})
	})

	describe("Hidden mode parent-child relationships", () => {
		it("should correctly identify parent-child relationships", () => {
			const hiddenMode = getModeBySlug("hidden-submode", customModes)
			const parentMode = getModeBySlug("parent-mode", customModes)

			expect(hiddenMode?.parent).toBe(parentMode?.slug)
		})

		it("should allow multiple hidden modes with same parent", () => {
			const modesWithMultipleChildren: ModeConfig[] = [
				...customModes,
				{
					slug: "hidden-submode-2",
					name: "Hidden Submode 2",
					roleDefinition: "Hidden submode 2 role",
					groups: ["read"],
					hidden: true,
					parent: "parent-mode",
				},
			]

			const modes = getAllModes(modesWithMultipleChildren, true)
			const hiddenModes = modes.filter((m) => m.hidden && m.parent === "parent-mode")

			expect(hiddenModes.length).toBe(2)
		})
	})
})
