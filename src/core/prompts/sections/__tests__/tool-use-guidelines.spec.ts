import { getToolUseGuidelinesSection } from "../tool-use-guidelines"

describe("getToolUseGuidelinesSection", () => {
	it("returns base guidelines without re-anchor text when no experiments provided", () => {
		const result = getToolUseGuidelinesSection()
		expect(result).toContain("Tool Use Guidelines")
		expect(result).toContain("Assess what information you already have")
		expect(result).not.toContain("Re-anchor before every file edit")
	})

	it("returns base guidelines without re-anchor text when experiment is disabled", () => {
		const result = getToolUseGuidelinesSection({ reAnchorBeforeEdit: false })
		expect(result).toContain("Tool Use Guidelines")
		expect(result).not.toContain("Re-anchor before every file edit")
	})

	it("includes re-anchor guideline when experiment is enabled", () => {
		const result = getToolUseGuidelinesSection({ reAnchorBeforeEdit: true })
		expect(result).toContain("Tool Use Guidelines")
		expect(result).toContain("Re-anchor before every file edit")
		expect(result).toContain("re-read the file")
		expect(result).toContain("read_file")
	})

	it("returns base guidelines when empty experiments object provided", () => {
		const result = getToolUseGuidelinesSection({})
		expect(result).toContain("Tool Use Guidelines")
		expect(result).not.toContain("Re-anchor before every file edit")
	})
})
