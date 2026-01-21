// npx vitest run src/shared/__tests__/typeGuards.spec.ts

import { isFiniteNumber, isDiffStats } from "../typeGuards"

describe("typeGuards", () => {
	describe("isFiniteNumber", () => {
		it("should return true for finite numbers", () => {
			expect(isFiniteNumber(0)).toBe(true)
			expect(isFiniteNumber(42)).toBe(true)
			expect(isFiniteNumber(-10)).toBe(true)
			expect(isFiniteNumber(3.14)).toBe(true)
			expect(isFiniteNumber(-0.5)).toBe(true)
		})

		it("should return false for non-finite numbers", () => {
			expect(isFiniteNumber(Infinity)).toBe(false)
			expect(isFiniteNumber(-Infinity)).toBe(false)
			expect(isFiniteNumber(NaN)).toBe(false)
		})

		it("should return false for non-number types", () => {
			expect(isFiniteNumber("42")).toBe(false)
			expect(isFiniteNumber(null)).toBe(false)
			expect(isFiniteNumber(undefined)).toBe(false)
			expect(isFiniteNumber(true)).toBe(false)
			expect(isFiniteNumber({})).toBe(false)
			expect(isFiniteNumber([])).toBe(false)
		})
	})

	describe("isDiffStats", () => {
		it("should return true for valid DiffStats objects", () => {
			expect(isDiffStats({ added: 0, removed: 0 })).toBe(true)
			expect(isDiffStats({ added: 10, removed: 5 })).toBe(true)
			expect(isDiffStats({ added: 100, removed: 200 })).toBe(true)
		})

		it("should return false for objects with non-finite numbers", () => {
			expect(isDiffStats({ added: Infinity, removed: 5 })).toBe(false)
			expect(isDiffStats({ added: 10, removed: NaN })).toBe(false)
			expect(isDiffStats({ added: NaN, removed: Infinity })).toBe(false)
		})

		it("should return false for objects with non-number properties", () => {
			expect(isDiffStats({ added: "10", removed: 5 })).toBe(false)
			expect(isDiffStats({ added: 10, removed: "5" })).toBe(false)
			expect(isDiffStats({ added: null, removed: 5 })).toBe(false)
			expect(isDiffStats({ added: 10, removed: undefined })).toBe(false)
		})

		it("should return false for objects missing required properties", () => {
			expect(isDiffStats({ added: 10 })).toBe(false)
			expect(isDiffStats({ removed: 5 })).toBe(false)
			expect(isDiffStats({})).toBe(false)
		})

		it("should return false for non-object types", () => {
			expect(isDiffStats(null)).toBe(false)
			expect(isDiffStats(undefined)).toBe(false)
			expect(isDiffStats("string")).toBe(false)
			expect(isDiffStats(42)).toBe(false)
			expect(isDiffStats([])).toBe(false)
			expect(isDiffStats(true)).toBe(false)
		})

		it("should ignore extra properties on valid objects", () => {
			expect(isDiffStats({ added: 10, removed: 5, extra: "value" })).toBe(true)
		})
	})
})
