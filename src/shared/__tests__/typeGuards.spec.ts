// npx vitest run src/shared/__tests__/typeGuards.spec.ts

import { isFiniteNumber } from "../typeGuards"

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
})
