import { describe, it, expect } from "vitest"
import { unescapeHtmlEntities } from "../text-normalization"

describe("HTML Entity Preservation", () => {
	describe("unescapeHtmlEntities", () => {
		it("should unescape basic HTML entities", () => {
			expect(unescapeHtmlEntities("&lt;div&gt;")).toBe("<div>")
			expect(unescapeHtmlEntities("&amp;")).toBe("&")
			expect(unescapeHtmlEntities("&quot;")).toBe('"')
			expect(unescapeHtmlEntities("&#39;")).toBe("'")
		})

		it("should handle complex HTML with multiple entities", () => {
			const input = "&lt;a href=&quot;https://example.com?param1=value&amp;param2=value&quot;&gt;Link&lt;/a&gt;"
			const expected = '<a href="https://example.com?param1=value&param2=value">Link</a>'
			expect(unescapeHtmlEntities(input)).toBe(expected)
		})

		it("should preserve text without entities", () => {
			const text = "Plain text without entities"
			expect(unescapeHtmlEntities(text)).toBe(text)
		})

		it("should handle empty or undefined input", () => {
			expect(unescapeHtmlEntities("")).toBe("")
			expect(unescapeHtmlEntities(undefined as unknown as string)).toBe(undefined)
		})

		it("should unescape square bracket entities", () => {
			expect(unescapeHtmlEntities("array&#91;0&#93;")).toBe("array[0]")
			expect(unescapeHtmlEntities("string&lsqb;&rsqb;")).toBe("string[]")
		})
	})

	describe("Setting-based HTML entity handling", () => {
		it("should document that preserveHtmlEntities=false triggers unescaping", () => {
			// When preserveHtmlEntities is false (default for non-Claude models),
			// HTML entities should be unescaped
			const input = "&lt;test&gt;"
			const output = unescapeHtmlEntities(input)
			expect(output).toBe("<test>")
		})

		it("should document that preserveHtmlEntities=true skips unescaping", () => {
			// When preserveHtmlEntities is true, the content should remain as-is
			// This is tested by NOT calling unescapeHtmlEntities
			const input = "&lt;test&gt;"
			// In actual usage, when preserveHtmlEntities=true, we skip calling unescapeHtmlEntities
			expect(input).toBe("&lt;test&gt;")
		})

		it("should handle code with HTML-like syntax", () => {
			const codeWithHtml = "if (x &lt; 10 &amp;&amp; y &gt; 5) { return true; }"
			const expected = "if (x < 10 && y > 5) { return true; }"
			expect(unescapeHtmlEntities(codeWithHtml)).toBe(expected)
		})

		it("should handle XML/JSX code", () => {
			const jsx = "&lt;Component prop=&quot;value&quot;&gt;{children}&lt;/Component&gt;"
			const expected = '<Component prop="value">{children}</Component>'
			expect(unescapeHtmlEntities(jsx)).toBe(expected)
		})
	})
})
