import { describe, it, expect } from "vitest"
import { ReasoningXmlMatcher } from "../reasoning-xml-matcher"

describe("ReasoningXmlMatcher", () => {
	it("should match <think> tags", () => {
		const matcher = new ReasoningXmlMatcher()
		const input = "Some text <think>This is reasoning content</think> more text"
		const results = matcher.final(input)

		expect(results).toHaveLength(3)
		expect(results[0]).toEqual({ matched: false, data: "Some text " })
		expect(results[1]).toEqual({ matched: true, data: "<think>This is reasoning content</think>" })
		expect(results[2]).toEqual({ matched: false, data: " more text" })
	})

	it("should match <thinking> tags", () => {
		const matcher = new ReasoningXmlMatcher()
		const input = "Some text <thinking>This is reasoning content</thinking> more text"
		const results = matcher.final(input)

		expect(results).toHaveLength(3)
		expect(results[0]).toEqual({ matched: false, data: "Some text " })
		expect(results[1]).toEqual({ matched: true, data: "<thinking>This is reasoning content</thinking>" })
		expect(results[2]).toEqual({ matched: false, data: " more text" })
	})

	it("should match <reasoning> tags", () => {
		const matcher = new ReasoningXmlMatcher()
		const input = "Some text <reasoning>This is reasoning content</reasoning> more text"
		const results = matcher.final(input)

		expect(results).toHaveLength(3)
		expect(results[0]).toEqual({ matched: false, data: "Some text " })
		expect(results[1]).toEqual({ matched: true, data: "<reasoning>This is reasoning content</reasoning>" })
		expect(results[2]).toEqual({ matched: false, data: " more text" })
	})

	it("should match <thought> tags", () => {
		const matcher = new ReasoningXmlMatcher()
		const input = "Some text <thought>This is reasoning content</thought> more text"
		const results = matcher.final(input)

		expect(results).toHaveLength(3)
		expect(results[0]).toEqual({ matched: false, data: "Some text " })
		expect(results[1]).toEqual({ matched: true, data: "<thought>This is reasoning content</thought>" })
		expect(results[2]).toEqual({ matched: false, data: " more text" })
	})

	it("should handle streaming updates for all tag variants", () => {
		const testCases = [
			{ tag: "think", content: "Thinking about the problem" },
			{ tag: "thinking", content: "Processing the request" },
			{ tag: "reasoning", content: "Analyzing the situation" },
			{ tag: "thought", content: "Considering options" },
		]

		testCases.forEach(({ tag, content }) => {
			const matcher = new ReasoningXmlMatcher()

			// Simulate streaming
			const chunks = [
				"Initial text ",
				`<${tag}>`,
				content.slice(0, 10),
				content.slice(10),
				`</${tag}>`,
				" final text",
			]

			let allResults: any[] = []
			chunks.forEach((chunk) => {
				const results = matcher.update(chunk)
				allResults.push(...results)
			})

			// Get final results
			const finalResults = matcher.final()
			allResults.push(...finalResults)

			// Verify we got the expected matched content
			const matchedResults = allResults.filter((r) => r.matched)
			const unmatchedResults = allResults.filter((r) => !r.matched)

			expect(matchedResults.length).toBeGreaterThan(0)
			const fullMatchedContent = matchedResults.map((r) => r.data).join("")
			expect(fullMatchedContent).toContain(content)

			const fullUnmatchedContent = unmatchedResults.map((r) => r.data).join("")
			expect(fullUnmatchedContent).toContain("Initial text")
			expect(fullUnmatchedContent).toContain("final text")
		})
	})

	it("should handle nested tags correctly", () => {
		const matcher = new ReasoningXmlMatcher()
		const input = "<think>Outer <think>Inner</think> content</think>"
		const results = matcher.final(input)

		// Should match the entire nested structure
		expect(results).toHaveLength(1)
		expect(results[0]).toEqual({
			matched: true,
			data: "<think>Outer <think>Inner</think> content</think>",
		})
	})

	it("should handle multiple different reasoning tags in sequence", () => {
		const matcher = new ReasoningXmlMatcher()
		const input = "Text <think>Think content</think> middle <thinking>Thinking content</thinking> end"
		const results = matcher.final(input)

		// Should match only the first tag type encountered
		expect(results.filter((r) => r.matched).length).toBeGreaterThan(0)
		expect(results.some((r) => r.data.includes("Think content"))).toBe(true)
	})

	it("should apply custom transform function", () => {
		const transform = (chunk: { matched: boolean; data: string }) => ({
			type: chunk.matched ? "reasoning" : "text",
			text: chunk.data,
		})

		const matcher = new ReasoningXmlMatcher(transform)
		const input = "Normal text <think>Reasoning here</think> more text"
		const results = matcher.final(input)

		expect(results[0]).toEqual({ type: "text", text: "Normal text " })
		expect(results[1]).toEqual({ type: "reasoning", text: "<think>Reasoning here</think>" })
		expect(results[2]).toEqual({ type: "text", text: " more text" })
	})
})
