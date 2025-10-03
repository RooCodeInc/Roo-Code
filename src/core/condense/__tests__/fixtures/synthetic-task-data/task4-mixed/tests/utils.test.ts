import { describe, it, expect, vi } from "vitest"
import { formatTimestamp, isValidEmail, delay, generateId, safeJsonParse, capitalize } from "../utils"

describe("formatTimestamp", () => {
	it("should format a date to ISO string", () => {
		const date = new Date("2024-01-01T12:00:00.000Z")
		const result = formatTimestamp(date)
		expect(result).toBe("2024-01-01T12:00:00.000Z")
	})
})

describe("isValidEmail", () => {
	it("should return true for valid email addresses", () => {
		expect(isValidEmail("test@example.com")).toBe(true)
		expect(isValidEmail("user.name@domain.co.uk")).toBe(true)
	})

	it("should return false for invalid email addresses", () => {
		expect(isValidEmail("invalid")).toBe(false)
		expect(isValidEmail("no@domain")).toBe(false)
		expect(isValidEmail("@domain.com")).toBe(false)
	})
})

describe("delay", () => {
	it("should delay execution for specified milliseconds", async () => {
		const start = Date.now()
		await delay(100)
		const elapsed = Date.now() - start
		expect(elapsed).toBeGreaterThanOrEqual(90) // Allow for small timing variations
	})
})

describe("generateId", () => {
	it("should generate a unique ID with default prefix", () => {
		const id1 = generateId()
		const id2 = generateId()
		expect(id1).toMatch(/^id-\d+-[a-z0-9]+$/)
		expect(id1).not.toBe(id2)
	})

	it("should generate a unique ID with custom prefix", () => {
		const id = generateId("user")
		expect(id).toMatch(/^user-\d+-[a-z0-9]+$/)
	})
})

describe("safeJsonParse", () => {
	it("should parse valid JSON", () => {
		const result = safeJsonParse<{ name: string }>('{"name":"test"}')
		expect(result).toEqual({ name: "test" })
	})

	it("should return null for invalid JSON", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		const result = safeJsonParse("invalid json")
		expect(result).toBeNull()
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})
})

describe("capitalize", () => {
	it("should capitalize the first letter of a string", () => {
		expect(capitalize("hello")).toBe("Hello")
		expect(capitalize("world")).toBe("World")
	})

	it("should handle empty strings", () => {
		expect(capitalize("")).toBe("")
	})

	it("should handle single character strings", () => {
		expect(capitalize("a")).toBe("A")
	})

	it("should not affect already capitalized strings", () => {
		expect(capitalize("Hello")).toBe("Hello")
	})
})
