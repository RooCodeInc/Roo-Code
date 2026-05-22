import { render, screen } from "@/utils/test-utils"

import MarkdownBlock from "../MarkdownBlock"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		theme: "dark",
	}),
}))

describe("MarkdownBlock", () => {
	it("should correctly handle URLs with trailing punctuation", async () => {
		const markdown = "Check out this link: https://example.com."
		const { container } = render(<MarkdownBlock markdown={markdown} />)

		// Wait for the content to be processed
		await screen.findByText(/Check out this link/, { exact: false })

		// Check for nested links - this should not happen
		const nestedLinks = container.querySelectorAll("a a")
		expect(nestedLinks.length).toBe(0)

		// Should have exactly one link
		const linkElement = screen.getByRole("link")
		expect(linkElement).toHaveAttribute("href", "https://example.com")
		expect(linkElement.textContent).toBe("https://example.com")

		// Check that the period is outside the link
		const paragraph = container.querySelector("p")
		expect(paragraph?.textContent).toBe("Check out this link: https://example.com.")
	}, 10000)

	it("should render unordered lists with proper styling", async () => {
		const markdown = `Here are some items:
- First item
- Second item
  - Nested item
  - Another nested item`

		const { container } = render(<MarkdownBlock markdown={markdown} />)

		// Wait for the content to be processed
		await screen.findByText(/Here are some items/, { exact: false })

		// Check that ul elements exist
		const ulElements = container.querySelectorAll("ul")
		expect(ulElements.length).toBeGreaterThan(0)

		// Check that list items exist
		const liElements = container.querySelectorAll("li")
		expect(liElements.length).toBe(4)

		// Verify the text content
		expect(screen.getByText("First item")).toBeInTheDocument()
		expect(screen.getByText("Second item")).toBeInTheDocument()
		expect(screen.getByText("Nested item")).toBeInTheDocument()
		expect(screen.getByText("Another nested item")).toBeInTheDocument()
	})

	it("should render ordered lists with proper styling", async () => {
		const markdown = `And a numbered list:
1. Step one
2. Step two
3. Step three`

		const { container } = render(<MarkdownBlock markdown={markdown} />)

		// Wait for the content to be processed
		await screen.findByText(/And a numbered list/, { exact: false })

		// Check that ol elements exist
		const olElements = container.querySelectorAll("ol")
		expect(olElements.length).toBe(1)

		// Check that list items exist
		const liElements = container.querySelectorAll("li")
		expect(liElements.length).toBe(3)

		// Verify the text content
		expect(screen.getByText("Step one")).toBeInTheDocument()
		expect(screen.getByText("Step two")).toBeInTheDocument()
		expect(screen.getByText("Step three")).toBeInTheDocument()
	})

	it("should render nested lists with proper hierarchy", async () => {
		const markdown = `Complex list:
1. First level ordered
   - Second level unordered
   - Another second level
     1. Third level ordered
     2. Another third level
2. Back to first level`

		const { container } = render(<MarkdownBlock markdown={markdown} />)

		// Wait for the content to be processed
		await screen.findByText(/Complex list/, { exact: false })

		// Check nested structure
		const olElements = container.querySelectorAll("ol")
		const ulElements = container.querySelectorAll("ul")

		expect(olElements.length).toBeGreaterThan(0)
		expect(ulElements.length).toBeGreaterThan(0)

		// Verify all text is rendered
		expect(screen.getByText("First level ordered")).toBeInTheDocument()
		expect(screen.getByText("Second level unordered")).toBeInTheDocument()
		expect(screen.getByText("Third level ordered")).toBeInTheDocument()
		expect(screen.getByText("Back to first level")).toBeInTheDocument()
	})

	describe("GitHub-style Markdown alerts", () => {
		it("should render a NOTE alert with title and content", async () => {
			const markdown = "> [!NOTE]\n> This is useful information."
			const { container } = render(<MarkdownBlock markdown={markdown} />)

			await screen.findByText("Note")
			const alertEl = container.querySelector(".markdown-alert-note")
			expect(alertEl).toBeInTheDocument()
			expect(screen.getByText("Note")).toBeInTheDocument()
			expect(screen.getByText(/This is useful information/)).toBeInTheDocument()
		})

		it("should render all five alert types", async () => {
			const types = [
				{ marker: "NOTE", label: "Note", cssClass: "markdown-alert-note" },
				{ marker: "TIP", label: "Tip", cssClass: "markdown-alert-tip" },
				{ marker: "IMPORTANT", label: "Important", cssClass: "markdown-alert-important" },
				{ marker: "WARNING", label: "Warning", cssClass: "markdown-alert-warning" },
				{ marker: "CAUTION", label: "Caution", cssClass: "markdown-alert-caution" },
			]

			for (const { marker, label, cssClass } of types) {
				const markdown = `> [!${marker}]\n> Alert content for ${marker}.`
				const { container } = render(<MarkdownBlock markdown={markdown} />)

				await screen.findByText(label)
				const alertEl = container.querySelector(`.${cssClass}`)
				expect(alertEl).toBeInTheDocument()
			}
		})

		it("should render normal blockquotes unchanged", async () => {
			const markdown = "> This is a normal blockquote."
			const { container } = render(<MarkdownBlock markdown={markdown} />)

			await screen.findByText(/This is a normal blockquote/)
			const blockquote = container.querySelector("blockquote")
			expect(blockquote).toBeInTheDocument()
			// Should NOT have alert classes
			const alertEl = container.querySelector(".markdown-alert")
			expect(alertEl).not.toBeInTheDocument()
		})

		it("should render multiline alert content", async () => {
			const markdown = "> [!WARNING]\n> Line one.\n> Line two.\n> Line three."
			const { container } = render(<MarkdownBlock markdown={markdown} />)

			await screen.findByText("Warning")
			const alertEl = container.querySelector(".markdown-alert-warning")
			expect(alertEl).toBeInTheDocument()
			expect(container.textContent).toContain("Line one.")
			expect(container.textContent).toContain("Line two.")
			expect(container.textContent).toContain("Line three.")
		})

		it("should fall back to normal blockquote for unsupported markers", async () => {
			const markdown = "> [!DANGER]\n> This is unsupported."
			const { container } = render(<MarkdownBlock markdown={markdown} />)

			await screen.findByText(/DANGER/)
			const blockquote = container.querySelector("blockquote")
			expect(blockquote).toBeInTheDocument()
			const alertEl = container.querySelector(".markdown-alert")
			expect(alertEl).not.toBeInTheDocument()
		})

		it("should handle alert with inline formatting", async () => {
			const markdown = "> [!TIP]\n> Use `code` and **bold** text."
			const { container } = render(<MarkdownBlock markdown={markdown} />)

			await screen.findByText("Tip")
			const alertEl = container.querySelector(".markdown-alert-tip")
			expect(alertEl).toBeInTheDocument()
			const codeEl = alertEl?.querySelector("code")
			expect(codeEl).toBeInTheDocument()
			expect(codeEl?.textContent).toBe("code")
		})

		it("should handle alert marker with content on the same line", async () => {
			const markdown = "> [!CAUTION] Be careful!"
			const { container } = render(<MarkdownBlock markdown={markdown} />)

			await screen.findByText("Caution")
			const alertEl = container.querySelector(".markdown-alert-caution")
			expect(alertEl).toBeInTheDocument()
			expect(container.textContent).toContain("Be careful!")
		})
	})
})
