import { formatResponse } from "../responses"

describe("formatResponse.writeToFileMissingContentError", () => {
	describe("first failure (tier 1)", () => {
		it("should include the file path in the error message", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).toContain("src/index.ts")
		})

		it("should include the base error explanation", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).toContain("'content' parameter was empty")
			expect(result).toContain("output token limits")
		})

		it("should include helpful suggestions", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).toContain("Suggestions")
			expect(result).toContain("apply_diff")
		})

		it("should include the tool use instructions reminder", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).toContain("Reminder: Instructions for Tool Use")
		})

		it("should mention breaking down the task into smaller steps", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).toContain("breaking down the task into smaller steps")
		})

		it("should suggest using apply_diff or edit for existing files", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).toContain("prefer apply_diff or edit to make targeted edits")
		})

		it("should not include CRITICAL language on first failure", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).not.toContain("CRITICAL")
		})

		it("should work with different file paths", () => {
			const result = formatResponse.writeToFileMissingContentError("components/MyComponent.tsx", 1)
			expect(result).toContain("components/MyComponent.tsx")
		})
	})

	describe("second failure (tier 2)", () => {
		it("should indicate this is the 2nd failed attempt", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 2)
			expect(result).toContain("2nd failed attempt")
		})

		it("should strongly suggest alternative approaches", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 2)
			expect(result).toContain("must use a different strategy")
			expect(result).toContain("Recommended approaches")
		})

		it("should tell model not to retry full write again", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 2)
			expect(result).toContain("Do NOT attempt to write the full file content")
		})

		it("should not include CRITICAL language on second failure", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 2)
			expect(result).not.toContain("CRITICAL")
		})
	})

	describe("third+ failure (tier 3)", () => {
		it("should include CRITICAL language on third failure", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 3)
			expect(result).toContain("CRITICAL")
			expect(result).toContain("3 times in a row")
		})

		it("should tell model to NOT retry write_to_file", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 3)
			expect(result).toContain("do NOT retry write_to_file")
		})

		it("should include required action strategies", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 3)
			expect(result).toContain("Required action")
			expect(result).toContain("apply_diff or edit")
			expect(result).toContain("50-100 lines")
		})

		it("should show correct count for higher failure counts", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 5)
			expect(result).toContain("5 times in a row")
		})
	})

	describe("context window awareness", () => {
		it("should include context warning when usage exceeds 50%", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1, 60)
			expect(result).toContain("60% full")
			expect(result).toContain("output capacity is reduced")
		})

		it("should not include context warning when usage is 50% or below", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1, 50)
			expect(result).not.toContain("% full")
		})

		it("should not include context warning when usage is undefined", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 1)
			expect(result).not.toContain("% full")
		})

		it("should include context warning in tier 2 messages", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 2, 75)
			expect(result).toContain("75% full")
		})

		it("should include context warning in tier 3 messages", () => {
			const result = formatResponse.writeToFileMissingContentError("src/index.ts", 3, 90)
			expect(result).toContain("90% full")
		})
	})
})
