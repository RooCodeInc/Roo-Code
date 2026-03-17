import { isRecord } from "../guards.js"

describe("isRecord", () => {
	it("returns true for plain objects", () => {
		expect(isRecord({})).toBe(true)
		expect(isRecord({ a: 1 })).toBe(true)
	})

	it("returns true for arrays (arrays are objects)", () => {
		expect(isRecord([])).toBe(true)
	})

	it("returns false for null", () => {
		expect(isRecord(null)).toBe(false)
	})

	it("returns false for undefined", () => {
		expect(isRecord(undefined)).toBe(false)
	})

	it("returns false for primitives", () => {
		expect(isRecord("string")).toBe(false)
		expect(isRecord(42)).toBe(false)
		expect(isRecord(true)).toBe(false)
		expect(isRecord(Symbol("s"))).toBe(false)
	})
})
