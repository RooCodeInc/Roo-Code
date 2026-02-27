import { deserializeBoolean, deserializeEnum, deserializeNumber, deserializeStringArray } from "../storage"

describe("storage deserializers", () => {
	it("deserializeNumber supports raw numbers and JSON numbers", () => {
		expect(deserializeNumber("42")).toBe(42)
		expect(deserializeNumber("3.14")).toBe(3.14)
		expect(deserializeNumber('"nope"')).toBeUndefined()
		expect(deserializeNumber("{bad json")).toBeUndefined()
	})

	it("deserializeStringArray returns [] on invalid input", () => {
		expect(deserializeStringArray("[]")).toEqual([])
		expect(deserializeStringArray('["a","b"]')).toEqual(["a", "b"])
		expect(deserializeStringArray("[1,2]")).toEqual([])
		expect(deserializeStringArray("{bad json")).toEqual([])
	})

	it("deserializeBoolean supports legacy raw strings and JSON booleans", () => {
		expect(deserializeBoolean("true")).toBe(true)
		expect(deserializeBoolean("false")).toBe(false)
		expect(deserializeBoolean('"true"')).toBe(false)
		expect(deserializeBoolean("{bad json")).toBe(false)
	})

	it("deserializeEnum supports legacy raw strings and JSON strings", () => {
		const allowed = new Set(["full", "partial"] as const)
		expect(deserializeEnum("full", allowed, "full")).toBe("full")
		expect(deserializeEnum('"partial"', allowed, "full")).toBe("partial")
		expect(deserializeEnum("{bad json", allowed, "full")).toBe("full")
		expect(deserializeEnum("other", allowed, "full")).toBe("full")
	})
})
