import { describe, expect, it } from "vitest"

import {
	normalizeBooleanSetting,
	normalizeNumberSetting,
	normalizeRpiCouncilApiConfigId,
	normalizeSandboxImage,
	normalizeSandboxMemoryLimit,
	normalizeSandboxNetworkAccess,
	normalizeVerificationStrictness,
} from "../rpiSettingsNormalization"

describe("rpiSettingsNormalization", () => {
	it("normalizes boolean-like values", () => {
		expect(normalizeBooleanSetting(true, false)).toBe(true)
		expect(normalizeBooleanSetting("true", false)).toBe(true)
		expect(normalizeBooleanSetting("false", true)).toBe(false)
		expect(normalizeBooleanSetting(1, false)).toBe(true)
		expect(normalizeBooleanSetting(0, true)).toBe(false)
		expect(normalizeBooleanSetting("invalid", true)).toBe(true)
	})

	it("normalizes and clamps numeric values", () => {
		expect(normalizeNumberSetting("11", 4, { min: 1, max: 10, integer: true })).toBe(10)
		expect(normalizeNumberSetting("7.8", 4, { min: 1, max: 10, integer: true })).toBe(7)
		expect(normalizeNumberSetting("abc", 4, { min: 1, max: 10, integer: true })).toBe(4)
	})

	it("normalizes strictness enum values", () => {
		expect(normalizeVerificationStrictness("STRICT", "lenient")).toBe("strict")
		expect(normalizeVerificationStrictness("standard", "lenient")).toBe("standard")
		expect(normalizeVerificationStrictness("unknown", "lenient")).toBe("lenient")
	})

	it("normalizes sandbox enum and string values", () => {
		expect(normalizeSandboxImage(" node:22 ", "node:20")).toBe("node:22")
		expect(normalizeSandboxImage("", "node:20")).toBe("node:20")
		expect(normalizeSandboxNetworkAccess("FULL", "restricted")).toBe("full")
		expect(normalizeSandboxNetworkAccess("invalid", "restricted")).toBe("restricted")
		expect(normalizeSandboxMemoryLimit("8G", "4g")).toBe("8g")
		expect(normalizeSandboxMemoryLimit("invalid", "4g")).toBe("4g")
	})

	it("normalizes council api config id", () => {
		expect(normalizeRpiCouncilApiConfigId("abc-123")).toBe("abc-123")
		expect(normalizeRpiCouncilApiConfigId(undefined)).toBe("")
		expect(normalizeRpiCouncilApiConfigId(42)).toBe("")
	})
})
