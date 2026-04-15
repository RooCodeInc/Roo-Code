import { TagMatcher } from "../tag-matcher"

describe("TagMatcher", () => {
	describe("single tag name (backward compatibility)", () => {
		it("should extract content inside <think> tags", () => {
			const matcher = new TagMatcher("think")
			const result = matcher.final("<think>reasoning here</think> output text")
			expect(result).toEqual([
				{ matched: true, data: "reasoning here" },
				{ matched: false, data: " output text" },
			])
		})

		it("should handle streamed chunks", () => {
			const matcher = new TagMatcher("think")
			const chunks = []
			chunks.push(...matcher.update("<thi"))
			chunks.push(...matcher.update("nk>reason"))
			chunks.push(...matcher.update("ing</think>"))
			chunks.push(...matcher.final(" done"))
			const allData = chunks.reduce(
				(acc, c) => {
					const key = c.matched ? "matched" : "unmatched"
					acc[key] += c.data
					return acc
				},
				{ matched: "", unmatched: "" },
			)
			expect(allData.matched).toBe("reasoning")
			expect(allData.unmatched).toBe(" done")
		})

		it("should pass through text with no tags", () => {
			const matcher = new TagMatcher("think")
			const result = matcher.final("just some text")
			expect(result).toEqual([{ matched: false, data: "just some text" }])
		})

		it("tagName getter returns first tag name", () => {
			const matcher = new TagMatcher("think")
			expect(matcher.tagName).toBe("think")
		})
	})

	describe("multiple tag names", () => {
		it("should extract content inside <thought> tags", () => {
			const matcher = new TagMatcher(["think", "thought"])
			const result = matcher.final("<thought>reasoning here</thought> output text")
			expect(result).toEqual([
				{ matched: true, data: "reasoning here" },
				{ matched: false, data: " output text" },
			])
		})

		it("should still extract content inside <think> tags", () => {
			const matcher = new TagMatcher(["think", "thought"])
			const result = matcher.final("<think>reasoning here</think> output text")
			expect(result).toEqual([
				{ matched: true, data: "reasoning here" },
				{ matched: false, data: " output text" },
			])
		})

		it("should handle streamed <thought> tags across chunks", () => {
			const matcher = new TagMatcher(["think", "thought"])
			const chunks = []
			chunks.push(...matcher.update("<thou"))
			chunks.push(...matcher.update("ght>my rea"))
			chunks.push(...matcher.update("soning</thought>"))
			chunks.push(...matcher.final(" answer"))
			const allData = chunks.reduce(
				(acc, c) => {
					const key = c.matched ? "matched" : "unmatched"
					acc[key] += c.data
					return acc
				},
				{ matched: "", unmatched: "" },
			)
			expect(allData.matched).toBe("my reasoning")
			expect(allData.unmatched).toBe(" answer")
		})

		it("should not match mismatched open/close tags", () => {
			// <think> opened but </thought> close - should not match as valid close
			const matcher = new TagMatcher(["think", "thought"])
			const result = matcher.final("<think>content</thought>more")
			// The close tag won't match because activeTagName is "think"
			// so </thought> is not recognized as closing it
			const matchedData = result.filter((c) => c.matched).map((c) => c.data)
			const unmatchedData = result.filter((c) => !c.matched).map((c) => c.data)
			// Content stays matched because the tag was never properly closed
			expect(matchedData.join("")).toContain("content")
			expect(unmatchedData.join("")).not.toContain("content")
		})

		it("should handle text before thought tag", () => {
			const matcher = new TagMatcher(["think", "thought"], undefined, 0)
			const result = matcher.final("<thought>reasoning</thought>answer")
			expect(result).toEqual([
				{ matched: true, data: "reasoning" },
				{ matched: false, data: "answer" },
			])
		})

		it("should ignore non-matching tags", () => {
			const matcher = new TagMatcher(["think", "thought"])
			const result = matcher.final("<div>not a match</div>")
			expect(result).toEqual([{ matched: false, data: "<div>not a match</div>" }])
		})

		it("tagName getter returns first tag name from array", () => {
			const matcher = new TagMatcher(["think", "thought"])
			expect(matcher.tagName).toBe("think")
		})

		it("tagNames contains all provided tag names", () => {
			const matcher = new TagMatcher(["think", "thought"])
			expect(matcher.tagNames).toEqual(["think", "thought"])
		})
	})

	describe("with transform", () => {
		it("should apply transform to thought tag results", () => {
			const matcher = new TagMatcher(["think", "thought"], (chunk) => ({
				type: chunk.matched ? "reasoning" : "text",
				text: chunk.data,
			}))
			const result = matcher.final("<thought>my reasoning</thought>my answer")
			expect(result).toEqual([
				{ type: "reasoning", text: "my reasoning" },
				{ type: "text", text: "my answer" },
			])
		})
	})
})
