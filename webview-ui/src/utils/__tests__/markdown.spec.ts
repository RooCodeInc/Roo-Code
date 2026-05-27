import { describe, expect, it } from "vitest"

import { countMarkdownHeadings, hasComplexMarkdown } from "../markdown"

describe("markdown heading helpers", () => {
	it("returns 0 for empty or undefined", () => {
		expect(countMarkdownHeadings(undefined)).toBe(0)
		expect(countMarkdownHeadings("")).toBe(0)
	})

	it("returns 0 for non-string truthy values", () => {
		// When subtasks return to main task, message.text can be a non-string value
		expect(countMarkdownHeadings(["# heading"] as unknown as string)).toBe(0)
		expect(countMarkdownHeadings({ text: "# heading" } as unknown as string)).toBe(0)
		expect(countMarkdownHeadings(42 as unknown as string)).toBe(0)
		expect(countMarkdownHeadings(true as unknown as string)).toBe(0)
	})

	it("counts single and multiple headings", () => {
		expect(countMarkdownHeadings("# One")).toBe(1)
		expect(countMarkdownHeadings("# One\nContent")).toBe(1)
		expect(countMarkdownHeadings("# One\n## Two")).toBe(2)
		expect(countMarkdownHeadings("# One\n## Two\n### Three")).toBe(3)
	})

	it("handles all heading levels", () => {
		const md = `# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6`
		expect(countMarkdownHeadings(md)).toBe(6)
	})

	it("ignores headings inside code fences", () => {
		const md = "# real\n```\n# not a heading\n```\n## real"
		expect(countMarkdownHeadings(md)).toBe(2)
	})

	it("hasComplexMarkdown requires at least two headings", () => {
		expect(hasComplexMarkdown("# One")).toBe(false)
		expect(hasComplexMarkdown("# One\n## Two")).toBe(true)
	})
})
