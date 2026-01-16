import { describe, expect, it } from "vitest"

import { countMarkdownHeadings, hasComplexMarkdown } from "../markdown"

describe("markdown heading helpers", () => {
	it("returns 0 for empty or undefined", () => {
		expect(countMarkdownHeadings(undefined)).toBe(0)
		expect(countMarkdownHeadings(""))
	})

	it("counts single and multiple headings", () => {
		expect(countMarkdownHeadings("# One"))
		expect(countMarkdownHeadings("# One\nContent"))
		expect(countMarkdownHeadings("# One\n## Two"))
		expect(countMarkdownHeadings("# One\n## Two\n### Three"))
	})

	it("handles all heading levels", () => {
		const md = `# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6`
		expect(countMarkdownHeadings(md))
	})

	it("ignores headings inside code fences", () => {
		const md = "# real\n```\n# not a heading\n```\n## real"
		expect(countMarkdownHeadings(md))
	})

	it("hasComplexMarkdown requires at least two headings", () => {
		expect(hasComplexMarkdown("# One"))
		expect(hasComplexMarkdown("# One\n## Two"))
	})
})
