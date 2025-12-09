import {
	compareSemver,
	meetsMinimumVersion,
	resolveVersionedSettings,
	isVersionedValue,
	type VersionedValue,
} from "../versionedSettings"

describe("versionedSettings", () => {
	describe("isVersionedValue", () => {
		it("should return true for valid versioned value objects", () => {
			const versionedValue: VersionedValue<string[]> = {
				value: ["search_replace"],
				minPluginVersion: "3.36.4",
			}
			expect(isVersionedValue(versionedValue)).toBe(true)
		})

		it("should return true for versioned value with any value type", () => {
			expect(isVersionedValue({ value: true, minPluginVersion: "1.0.0" })).toBe(true)
			expect(isVersionedValue({ value: 42, minPluginVersion: "1.0.0" })).toBe(true)
			expect(isVersionedValue({ value: "string", minPluginVersion: "1.0.0" })).toBe(true)
			expect(isVersionedValue({ value: null, minPluginVersion: "1.0.0" })).toBe(true)
			expect(isVersionedValue({ value: { nested: "object" }, minPluginVersion: "1.0.0" })).toBe(true)
		})

		it("should return false for non-versioned values", () => {
			expect(isVersionedValue(null)).toBe(false)
			expect(isVersionedValue(undefined)).toBe(false)
			expect(isVersionedValue("string")).toBe(false)
			expect(isVersionedValue(123)).toBe(false)
			expect(isVersionedValue(["array"])).toBe(false)
			expect(isVersionedValue({ value: "only value" })).toBe(false)
			expect(isVersionedValue({ minPluginVersion: "1.0.0" })).toBe(false)
			expect(isVersionedValue({ value: "test", minPluginVersion: 123 })).toBe(false) // version must be string
		})
	})

	describe("compareSemver", () => {
		it("should return 0 for equal versions", () => {
			expect(compareSemver("1.0.0", "1.0.0")).toBe(0)
			expect(compareSemver("3.36.4", "3.36.4")).toBe(0)
			expect(compareSemver("0.0.1", "0.0.1")).toBe(0)
		})

		it("should return positive when first version is greater", () => {
			expect(compareSemver("2.0.0", "1.0.0")).toBeGreaterThan(0)
			expect(compareSemver("1.1.0", "1.0.0")).toBeGreaterThan(0)
			expect(compareSemver("1.0.1", "1.0.0")).toBeGreaterThan(0)
			expect(compareSemver("3.36.5", "3.36.4")).toBeGreaterThan(0)
			expect(compareSemver("3.37.0", "3.36.4")).toBeGreaterThan(0)
			expect(compareSemver("4.0.0", "3.36.4")).toBeGreaterThan(0)
		})

		it("should return negative when first version is smaller", () => {
			expect(compareSemver("1.0.0", "2.0.0")).toBeLessThan(0)
			expect(compareSemver("1.0.0", "1.1.0")).toBeLessThan(0)
			expect(compareSemver("1.0.0", "1.0.1")).toBeLessThan(0)
			expect(compareSemver("3.36.3", "3.36.4")).toBeLessThan(0)
			expect(compareSemver("3.35.0", "3.36.4")).toBeLessThan(0)
			expect(compareSemver("2.0.0", "3.36.4")).toBeLessThan(0)
		})

		it("should handle versions with different segment counts", () => {
			expect(compareSemver("1.0", "1.0.0")).toBe(0)
			expect(compareSemver("1", "1.0.0")).toBe(0)
			expect(compareSemver("1.0.0.0", "1.0.0")).toBe(0)
			expect(compareSemver("1.0.1", "1.0")).toBeGreaterThan(0)
			expect(compareSemver("1.0", "1.0.1")).toBeLessThan(0)
		})

		it("should handle pre-release versions by ignoring pre-release suffix", () => {
			expect(compareSemver("3.36.4-beta.1", "3.36.4")).toBe(0)
			expect(compareSemver("3.36.4-rc.2", "3.36.4")).toBe(0)
			expect(compareSemver("3.36.5-alpha", "3.36.4")).toBeGreaterThan(0)
			expect(compareSemver("3.36.3-beta", "3.36.4")).toBeLessThan(0)
		})

		it("should handle edge cases", () => {
			expect(compareSemver("0.0.0", "0.0.0")).toBe(0)
			expect(compareSemver("10.20.30", "10.20.30")).toBe(0)
			expect(compareSemver("10.0.0", "9.99.99")).toBeGreaterThan(0)
		})
	})

	describe("meetsMinimumVersion", () => {
		it("should return true when current version equals minimum", () => {
			expect(meetsMinimumVersion("3.36.4", "3.36.4")).toBe(true)
		})

		it("should return true when current version exceeds minimum", () => {
			expect(meetsMinimumVersion("3.36.4", "3.36.5")).toBe(true)
			expect(meetsMinimumVersion("3.36.4", "3.37.0")).toBe(true)
			expect(meetsMinimumVersion("3.36.4", "4.0.0")).toBe(true)
		})

		it("should return false when current version is below minimum", () => {
			expect(meetsMinimumVersion("3.36.4", "3.36.3")).toBe(false)
			expect(meetsMinimumVersion("3.36.4", "3.35.0")).toBe(false)
			expect(meetsMinimumVersion("3.36.4", "2.0.0")).toBe(false)
		})
	})

	describe("resolveVersionedSettings", () => {
		const currentVersion = "3.36.4"

		it("should pass through non-versioned settings unchanged", () => {
			const settings = {
				includedTools: ["search_replace"],
				excludedTools: ["apply_diff"],
				supportsReasoningEffort: false,
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual(settings)
		})

		it("should include versioned settings when version requirement is met", () => {
			const settings = {
				includedTools: {
					value: ["search_replace"],
					minPluginVersion: "3.36.4",
				},
				excludedTools: {
					value: ["apply_diff"],
					minPluginVersion: "3.36.0",
				},
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual({
				includedTools: ["search_replace"],
				excludedTools: ["apply_diff"],
			})
		})

		it("should exclude versioned settings when version requirement is not met", () => {
			const settings = {
				includedTools: {
					value: ["search_replace"],
					minPluginVersion: "3.36.5", // Higher than current
				},
				excludedTools: {
					value: ["apply_diff"],
					minPluginVersion: "4.0.0", // Higher than current
				},
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual({})
		})

		it("should handle mixed versioned and non-versioned settings", () => {
			const settings = {
				supportsReasoningEffort: false, // Non-versioned, should be included
				includedTools: {
					value: ["search_replace"],
					minPluginVersion: "3.36.4", // Met, should be included
				},
				excludedTools: {
					value: ["apply_diff"],
					minPluginVersion: "4.0.0", // Not met, should be excluded
				},
				description: "A test model", // Non-versioned, should be included
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual({
				supportsReasoningEffort: false,
				includedTools: ["search_replace"],
				description: "A test model",
			})
		})

		it("should handle empty settings object", () => {
			const resolved = resolveVersionedSettings({}, currentVersion)
			expect(resolved).toEqual({})
		})

		it("should handle versioned boolean values", () => {
			const settings = {
				supportsNativeTools: {
					value: true,
					minPluginVersion: "3.36.0",
				},
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual({
				supportsNativeTools: true,
			})
		})

		it("should handle versioned null values", () => {
			const settings = {
				defaultTemperature: {
					value: null,
					minPluginVersion: "3.36.0",
				},
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual({
				defaultTemperature: null,
			})
		})

		it("should handle versioned nested objects", () => {
			const settings = {
				complexSetting: {
					value: { nested: { deeply: true } },
					minPluginVersion: "3.36.0",
				},
			}

			const resolved = resolveVersionedSettings(settings, currentVersion)

			expect(resolved).toEqual({
				complexSetting: { nested: { deeply: true } },
			})
		})

		it("should correctly resolve settings with exact version match", () => {
			const settings = {
				feature: {
					value: "enabled",
					minPluginVersion: "3.36.4", // Exact match
				},
			}

			const resolved = resolveVersionedSettings(settings, "3.36.4")

			expect(resolved).toEqual({
				feature: "enabled",
			})
		})
	})
})
