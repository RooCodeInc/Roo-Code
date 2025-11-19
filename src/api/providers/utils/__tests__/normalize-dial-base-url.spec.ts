import { describe, expect, it } from "vitest"

import { dialDefaultBaseUrl } from "@roo-code/types"

import { normalizeDialBaseUrl } from "../normalize-dial-base-url"

describe("normalizeDialBaseUrl", () => {
	it("falls back to the default URL when value is undefined", () => {
		expect(normalizeDialBaseUrl(undefined)).toBe(dialDefaultBaseUrl)
	})

	it("falls back to the default URL when value is blank", () => {
		expect(normalizeDialBaseUrl("   ")).toBe(dialDefaultBaseUrl)
	})

	it("returns the same host when no suffixes are present", () => {
		const base = "https://example.com/custom"
		expect(normalizeDialBaseUrl(base)).toBe(base)
	})

	it("strips trailing /openai", () => {
		expect(normalizeDialBaseUrl("https://example.com/openai")).toBe("https://example.com")
	})

	it("strips trailing /openai/", () => {
		expect(normalizeDialBaseUrl("https://example.com/openai/")).toBe("https://example.com")
	})

	it("strips trailing /openai/v1", () => {
		expect(normalizeDialBaseUrl("https://example.com/openai/v1")).toBe("https://example.com")
	})

	it("strips trailing /openai/v1/", () => {
		expect(normalizeDialBaseUrl("https://example.com/openai/v1/")).toBe("https://example.com")
	})

	it("handles uppercase suffixes", () => {
		expect(normalizeDialBaseUrl("https://example.com/OPENAI/V1/")).toBe("https://example.com")
	})

	it("trims whitespace before processing", () => {
		expect(normalizeDialBaseUrl("  https://example.com/openai  ")).toBe("https://example.com")
	})
})
