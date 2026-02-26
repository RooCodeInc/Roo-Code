import { createReadFileTool, DEFAULT_LINE_LIMIT } from "../read_file"

describe("createReadFileTool", () => {
	function getToolDesc(options = {}): string {
		const tool = createReadFileTool(options) as any
		return tool.function.description ?? ""
	}

	function getToolLimitParamDesc(options = {}): string {
		const tool = createReadFileTool(options) as any
		return tool.function.parameters.properties.limit.description ?? ""
	}

	it("uses DEFAULT_LINE_LIMIT in description when maxReadFileLine is undefined", () => {
		const desc = getToolDesc()
		expect(desc).toContain(`returns up to ${DEFAULT_LINE_LIMIT} lines per file`)
		expect(desc).not.toContain("no line limit")
	})

	it("uses DEFAULT_LINE_LIMIT in description when maxReadFileLine is -1", () => {
		const desc = getToolDesc({ maxReadFileLine: -1 })
		expect(desc).toContain(`returns up to ${DEFAULT_LINE_LIMIT} lines per file`)
	})

	it("indicates no limit in description when maxReadFileLine is 0", () => {
		const desc = getToolDesc({ maxReadFileLine: 0 })
		expect(desc).toContain("no line limit")
		expect(desc).not.toContain(`returns up to ${DEFAULT_LINE_LIMIT}`)

		const limitDesc = getToolLimitParamDesc({ maxReadFileLine: 0 })
		expect(limitDesc).toContain("no limit")
	})

	it("uses custom limit in description when maxReadFileLine is a positive number", () => {
		const desc = getToolDesc({ maxReadFileLine: 500 })
		expect(desc).toContain("returns up to 500 lines per file")
		// Should not mention DEFAULT_LINE_LIMIT as the line limit (but MAX_LINE_LENGTH=2000 chars is ok)
		expect(desc).not.toContain(`up to ${DEFAULT_LINE_LIMIT} lines`)

		const limitDesc = getToolLimitParamDesc({ maxReadFileLine: 500 })
		expect(limitDesc).toContain("500")
	})

	it("includes image support note when supportsImages is true", () => {
		const desc = getToolDesc({ supportsImages: true })
		expect(desc).toContain("image files")
	})

	it("does not include image support note when supportsImages is false", () => {
		const desc = getToolDesc({ supportsImages: false })
		expect(desc).not.toContain("image files")
	})
})
