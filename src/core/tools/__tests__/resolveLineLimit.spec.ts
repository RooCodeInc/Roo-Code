import { resolveLineLimit } from "../ReadFileTool"
import { DEFAULT_LINE_LIMIT } from "../../prompts/tools/native-tools/read_file"

describe("resolveLineLimit", () => {
	it("returns DEFAULT_LINE_LIMIT when undefined", () => {
		expect(resolveLineLimit(undefined)).toBe(DEFAULT_LINE_LIMIT)
	})

	it("returns DEFAULT_LINE_LIMIT when -1 (default setting)", () => {
		expect(resolveLineLimit(-1)).toBe(DEFAULT_LINE_LIMIT)
	})

	it("returns Infinity when 0 (no limit / read entire file)", () => {
		expect(resolveLineLimit(0)).toBe(Infinity)
	})

	it("returns the positive value as-is", () => {
		expect(resolveLineLimit(500)).toBe(500)
		expect(resolveLineLimit(10000)).toBe(10000)
	})

	it("returns DEFAULT_LINE_LIMIT for negative values other than -1", () => {
		expect(resolveLineLimit(-5)).toBe(DEFAULT_LINE_LIMIT)
	})

	it("returns DEFAULT_LINE_LIMIT when null-ish (null cast as number)", () => {
		// In practice, state?.maxReadFileLine could be null
		expect(resolveLineLimit(null as unknown as number)).toBe(DEFAULT_LINE_LIMIT)
	})
})
