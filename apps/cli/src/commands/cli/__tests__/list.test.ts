import { parseFormat } from "../list.js"

describe("parseFormat", () => {
	it("defaults to json when undefined", () => {
		expect(parseFormat(undefined)).toBe("json")
	})

	it("returns json for 'json'", () => {
		expect(parseFormat("json")).toBe("json")
	})

	it("returns text for 'text'", () => {
		expect(parseFormat("text")).toBe("text")
	})

	it("is case-insensitive", () => {
		expect(parseFormat("JSON")).toBe("json")
		expect(parseFormat("Text")).toBe("text")
		expect(parseFormat("TEXT")).toBe("text")
	})

	it("throws on invalid format", () => {
		expect(() => parseFormat("xml")).toThrow('Invalid format: xml. Must be "json" or "text".')
	})

	it("throws on empty string", () => {
		expect(() => parseFormat("")).toThrow("Invalid format")
	})
})
