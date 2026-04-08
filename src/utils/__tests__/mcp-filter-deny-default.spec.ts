/**
 * SE-1: Tests for isCustomModeWithoutConfig.
 *
 * This function returns true when the mode slug does NOT match any
 * built-in mode AND is NOT found in the customModes array — i.e. the
 * mode is a custom mode whose configuration is unavailable.
 */

import type { ModeConfig } from "@roo-code/types"

import { isCustomModeWithoutConfig } from "../mcp-filter"

// ---------------------------------------------------------------------------
// Helpers — minimal ModeConfig objects for testing.
// roleDefinition is required by the schema but the function under test only
// inspects slug matching, so we cast to ModeConfig for type-safety.
// ---------------------------------------------------------------------------

function minimalMode(slug: string, name: string, groups: string[]): ModeConfig {
	return {
		slug,
		name,
		roleDefinition: "test role",
		groups,
	} as ModeConfig
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("isCustomModeWithoutConfig", () => {
	it('returns false for built-in mode "code" with no custom modes', () => {
		expect(isCustomModeWithoutConfig("code", undefined)).toBe(false)
	})

	it('returns false for built-in mode "architect" with no custom modes', () => {
		expect(isCustomModeWithoutConfig("architect", undefined)).toBe(false)
	})

	it("returns true for unknown custom mode with no custom modes", () => {
		expect(isCustomModeWithoutConfig("my-custom", undefined)).toBe(true)
	})

	it("returns true for unknown custom mode with empty custom modes array", () => {
		expect(isCustomModeWithoutConfig("my-custom", [])).toBe(true)
	})

	it("returns false for custom mode when config is available", () => {
		const modes = [minimalMode("my-custom", "My Custom", ["read", "edit"])]
		expect(isCustomModeWithoutConfig("my-custom", modes)).toBe(false)
	})

	it("returns true for custom mode when only different modes in array", () => {
		const modes = [minimalMode("other-mode", "Other", ["read"])]
		expect(isCustomModeWithoutConfig("my-custom", modes)).toBe(true)
	})

	it("returns false for built-in mode even with custom modes array", () => {
		const modes = [minimalMode("my-custom", "My Custom", ["read"])]
		expect(isCustomModeWithoutConfig("code", modes)).toBe(false)
	})
})
