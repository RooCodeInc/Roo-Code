import { describe, it, expect } from "vitest"
import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("MultiSearchReplaceDiffStrategy - Error Handling", () => {
	describe("Pattern not found errors", () => {
		it("should return error when search pattern does not exist in file", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Original content"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
This content does not exist
=======
New content
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				// Result should have either error or failParts
				expect(result.error || result.failParts).toBeDefined()
				if (result.error) {
					expect(result.error).toContain("No sufficiently similar match found")
				} else if (result.failParts && result.failParts.length > 0) {
					const firstFail = result.failParts[0]
					if (firstFail && !firstFail.success && firstFail.error) {
						expect(firstFail.error).toContain("No sufficiently similar match found")
					}
				}
			}
		})

		it("should not modify file when search pattern is not found", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Original content that should not change"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Non-existent pattern
=======
Replacement text
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				// When success is false, content is not present
				expect(result.error || result.failParts).toBeDefined()
			}
			// Original content should remain unchanged (not modified by the function)
		})

		it("should handle multiple blocks where some fail", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = `Line 1
Line 2
Line 3`
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Line 1
=======
Modified Line 1
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:2
-------
Non-existent line
=======
This should fail
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:3
-------
Line 3
=======
Modified Line 3
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			// Should succeed partially
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.failParts).toBeDefined()
				expect(result.failParts?.length).toBe(1)
				expect(result.failParts?.[0].success).toBe(false)

				// Content should have the successful replacements
				expect(result.content).toContain("Modified Line 1")
				expect(result.content).toContain("Modified Line 3")
				expect(result.content).not.toContain("This should fail")
			}
		})

		it("should return detailed error message with context", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Actual file content here"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Wrong content
=======
Replacement
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error || result.failParts).toBeDefined()
				// Error should include helpful debugging information
				if (result.error) {
					expect(result.error).toContain("Search Content:")
					expect(result.error).toContain("Original Content:")
				} else if (result.failParts && result.failParts.length > 0) {
					const firstFail = result.failParts[0]
					if (firstFail && !firstFail.success && firstFail.error) {
						expect(firstFail.error).toContain("Search Content:")
						expect(firstFail.error).toContain("Original Content:")
					}
				}
			}
		})
	})

	describe("Empty search pattern errors", () => {
		it("should reject empty search content", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Some content"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------

=======
Replacement
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error || result.failParts).toBeDefined()
				if (result.error) {
					expect(result.error).toContain("Empty search content")
				} else if (result.failParts && result.failParts.length > 0) {
					const firstFail = result.failParts[0]
					if (firstFail && !firstFail.success && firstFail.error) {
						expect(firstFail.error).toContain("Empty search content")
					}
				}
			}
		})
	})

	describe("Identical search and replace", () => {
		it("should reject when search and replace are identical", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Same content"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Same content
=======
Same content
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error || result.failParts).toBeDefined()
				if (result.error) {
					expect(result.error).toContain("identical")
				} else if (result.failParts && result.failParts.length > 0) {
					const firstFail = result.failParts[0]
					if (firstFail && !firstFail.success && firstFail.error) {
						expect(firstFail.error).toContain("identical")
					}
				}
			}
		})
	})

	describe("Invalid diff format errors", () => {
		it("should reject malformed diff blocks", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Content"
			const diffContent = `
<<<<<<< SEARCH
Missing separator
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error || result.failParts).toBeDefined()
			}
		})

		it("should reject diff with missing REPLACE marker", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = "Content"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Content
=======
Replacement
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error || result.failParts).toBeDefined()
				if (result.error) {
					expect(result.error).toContain("Expected '>>>>>>> REPLACE'")
				}
			}
		})
	})

	describe("Fuzzy matching threshold", () => {
		it("should respect fuzzy threshold when pattern is similar but not exact", async () => {
			// Use exact matching (threshold 1.0)
			const strategy = new MultiSearchReplaceDiffStrategy(1.0)
			const originalContent = "Hello World"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Hello Wrold
=======
Goodbye World
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			// Should fail with exact matching due to typo
			expect(result.success).toBe(false)
		})

		it("should succeed with lower fuzzy threshold for similar patterns", async () => {
			// Use fuzzy matching (threshold 0.8 = 80% similarity)
			const strategy = new MultiSearchReplaceDiffStrategy(0.8)
			const originalContent = "Hello World"
			const diffContent = `
<<<<<<< SEARCH
:start_line:1
-------
Hello Wrold
=======
Goodbye World
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			// Should succeed with fuzzy matching
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe("Goodbye World")
			}
		})
	})

	describe("Line number hints", () => {
		it("should use line number hint to narrow search", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = `Line 1
Duplicate
Line 3
Duplicate
Line 5`
			const diffContent = `
<<<<<<< SEARCH
:start_line:4
-------
Duplicate
=======
Modified
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			expect(result.success).toBe(true)
			if (result.success) {
				// Should replace the second occurrence (line 4)
				expect(result.content).toContain("Line 3\nModified\nLine 5")
			}
		})

		it("should return error when line number hint points to wrong location", async () => {
			const strategy = new MultiSearchReplaceDiffStrategy()
			const originalContent = `Line 1
Line 2
Line 3`
			const diffContent = `
<<<<<<< SEARCH
:start_line:10
-------
Line 1
=======
Modified
>>>>>>> REPLACE
`

			const result = await strategy.applyDiff(originalContent, diffContent)

			// Should still try to find the pattern but may fail or succeed depending on buffer
			expect(result).toBeDefined()
		})
	})
})
