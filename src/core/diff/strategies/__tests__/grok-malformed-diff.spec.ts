import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../multi-file-search-replace"

describe("Grok Malformed Diff Detection", () => {
	describe("MultiSearchReplaceDiffStrategy", () => {
		let strategy: MultiSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiSearchReplaceDiffStrategy()
		})

		describe("detectGrokMalformedDiff", () => {
			it("detects consecutive separators", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(true)
			})

			it("detects separator before search marker", () => {
				const diff = "=======\n<<<<<<< SEARCH\ncontent\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(true)
			})

			it("detects too many separators", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(true)
			})

			it("returns false for valid diff", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\nreplacement\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(false)
			})

			it("returns false for multiple valid diffs", () => {
				const diff =
					"<<<<<<< SEARCH\ncontent1\n=======\nreplace1\n>>>>>>> REPLACE\n\n" +
					"<<<<<<< SEARCH\ncontent2\n=======\nreplace2\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(false)
			})
		})

		describe("analyzeDiffStructure", () => {
			it("provides debugging info for malformed diff", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["analyzeDiffStructure"](diff)

				expect(result).toContain("Found 1 SEARCH markers")
				expect(result).toContain("Found 2 separator (=======) markers")
				expect(result).toContain("Found 1 REPLACE markers")
				expect(result).toContain("WARNING: More separators than SEARCH blocks")
				expect(result).toContain("ERROR: Consecutive separators")
			})

			it("provides debugging info for unbalanced markers", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\nreplace\n<<<<<<< SEARCH\nanother"
				const result = strategy["analyzeDiffStructure"](diff)

				expect(result).toContain("Found 2 SEARCH markers")
				expect(result).toContain("Found 1 separator (=======) markers")
				expect(result).toContain("Found 0 REPLACE markers")
				expect(result).toContain("WARNING: Unbalanced markers")
			})
		})

		describe("validateMarkerSequencing with Grok detection", () => {
			it("returns helpful error for Grok-style malformed diff", () => {
				const diff = "=======\ncontent\n>>>>>>> REPLACE"
				const result = strategy["validateMarkerSequencing"](diff)

				expect(result.success).toBe(false)
				expect(result.error).toContain("The diff content appears to be malformed")
				expect(result.error).toContain("This often happens when AI models generate incorrect diff syntax")
				expect(result.error).toContain("DEBUGGING INFO:")
				expect(result.error).toContain("SUGGESTIONS:")
				expect(result.debugInfo).toBeDefined()
			})

			it("returns helpful error for consecutive separators", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["validateMarkerSequencing"](diff)

				expect(result.success).toBe(false)
				expect(result.error).toContain("The diff content appears to be malformed")
				expect(result.error).toContain("Try using the read_file tool first")
				expect(result.error).toContain("Use simpler, smaller diff blocks")
			})

			it("still validates normal diffs correctly", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\nreplacement\n>>>>>>> REPLACE"
				const result = strategy["validateMarkerSequencing"](diff)

				expect(result.success).toBe(true)
			})
		})

		describe("applyDiff with malformed content", () => {
			it("returns error with debug info for malformed diff", async () => {
				const originalContent = "function test() {\n  return true;\n}"
				const malformedDiff = "=======\nfunction test() {\n  return false;\n}\n>>>>>>> REPLACE"

				const result = await strategy.applyDiff(originalContent, malformedDiff)

				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.error).toContain("The diff content appears to be malformed")
				}
			})

			it("handles Grok-style issues gracefully", async () => {
				const originalContent = "const x = 1;"
				const grokDiff = "<<<<<<< SEARCH\nconst x = 1;\n=======\n=======\nconst x = 2;\n>>>>>>> REPLACE"

				const result = await strategy.applyDiff(originalContent, grokDiff)

				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.error).toContain("The diff content appears to be malformed")
					expect(result.error).toContain("ERROR: Consecutive separators")
				}
			})
		})
	})

	describe("MultiFileSearchReplaceDiffStrategy", () => {
		let strategy: MultiFileSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiFileSearchReplaceDiffStrategy()
		})

		describe("detectGrokMalformedDiff", () => {
			it("detects consecutive separators", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(true)
			})

			it("detects separator before search marker", () => {
				const diff = "=======\n<<<<<<< SEARCH\ncontent\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(true)
			})

			it("detects too many separators", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(true)
			})

			it("returns false for valid diff", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\nreplacement\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(false)
			})

			it("returns false for multiple valid diffs", () => {
				const diff =
					"<<<<<<< SEARCH\ncontent1\n=======\nreplace1\n>>>>>>> REPLACE\n\n" +
					"<<<<<<< SEARCH\ncontent2\n=======\nreplace2\n>>>>>>> REPLACE"
				const result = strategy["detectGrokMalformedDiff"](diff)
				expect(result).toBe(false)
			})
		})

		describe("analyzeDiffStructure", () => {
			it("provides debugging info for malformed diff", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["analyzeDiffStructure"](diff)

				expect(result).toContain("Found 1 SEARCH markers")
				expect(result).toContain("Found 2 separator (=======) markers")
				expect(result).toContain("Found 1 REPLACE markers")
				expect(result).toContain("WARNING: More separators than SEARCH blocks")
				expect(result).toContain("ERROR: Consecutive separators")
			})

			it("provides debugging info for unbalanced markers", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\nreplace\n<<<<<<< SEARCH\nanother"
				const result = strategy["analyzeDiffStructure"](diff)

				expect(result).toContain("Found 2 SEARCH markers")
				expect(result).toContain("Found 1 separator (=======) markers")
				expect(result).toContain("Found 0 REPLACE markers")
				expect(result).toContain("WARNING: Unbalanced markers")
			})
		})

		describe("validateMarkerSequencing with Grok detection", () => {
			it("returns helpful error for Grok-style malformed diff", () => {
				const diff = "=======\ncontent\n>>>>>>> REPLACE"
				const result = strategy["validateMarkerSequencing"](diff)

				expect(result.success).toBe(false)
				expect(result.error).toContain("The diff content appears to be malformed")
				expect(result.error).toContain("This often happens when AI models generate incorrect diff syntax")
				expect(result.error).toContain("DEBUGGING INFO:")
				expect(result.error).toContain("SUGGESTIONS:")
				expect(result.debugInfo).toBeDefined()
			})

			it("returns helpful error for consecutive separators", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\n=======\n>>>>>>> REPLACE"
				const result = strategy["validateMarkerSequencing"](diff)

				expect(result.success).toBe(false)
				expect(result.error).toContain("The diff content appears to be malformed")
				expect(result.error).toContain("Try using the read_file tool first")
				expect(result.error).toContain("Use simpler, smaller diff blocks")
			})

			it("still validates normal diffs correctly", () => {
				const diff = "<<<<<<< SEARCH\ncontent\n=======\nreplacement\n>>>>>>> REPLACE"
				const result = strategy["validateMarkerSequencing"](diff)

				expect(result.success).toBe(true)
			})
		})

		describe("applyDiff with malformed content", () => {
			it("returns error with debug info for malformed diff", async () => {
				const originalContent = "function test() {\n  return true;\n}"
				const malformedDiff = "=======\nfunction test() {\n  return false;\n}\n>>>>>>> REPLACE"

				const result = await strategy.applyDiff(originalContent, malformedDiff)

				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.error).toContain("The diff content appears to be malformed")
				}
			})

			it("handles Grok-style issues gracefully", async () => {
				const originalContent = "const x = 1;"
				const grokDiff = "<<<<<<< SEARCH\nconst x = 1;\n=======\n=======\nconst x = 2;\n>>>>>>> REPLACE"

				const result = await strategy.applyDiff(originalContent, grokDiff)

				expect(result.success).toBe(false)
				if (!result.success) {
					expect(result.error).toContain("The diff content appears to be malformed")
					expect(result.error).toContain("ERROR: Consecutive separators")
				}
			})
		})
	})

	describe("Real-world Grok scenarios", () => {
		let strategy: MultiSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiSearchReplaceDiffStrategy()
		})

		it("handles case where Grok adds consecutive separators", async () => {
			const originalContent = `function processPayment(amount) {
    // Process payment logic
    return { success: true };
}`

			// Simulating a Grok model that incorrectly adds consecutive separators
			// This triggers Grok detection
			const grokDiff = [
				"<<<<<<< SEARCH",
				"function processPayment(amount) {",
				"    // Process payment logic",
				"=======",
				"=======",
				"function processPayment(amount, currency) {",
				"    // Enhanced payment logic",
				">>>>>>> REPLACE",
			].join("\n")

			const result = await strategy.applyDiff(originalContent, grokDiff)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toContain("The diff content appears to be malformed")
			}
		})

		it("handles case where separator appears before search marker", async () => {
			// This simulates the exact issue @mrbm reported
			const originalContent = `export function calculateTotal(items) {
    let total = 0;
    for (const item of items) {
        total += item.price;
    }
    return total;
}`

			// Malformed diff that Grok might generate - separator before search
			const malformedDiff = [
				"=======",
				"<<<<<<< SEARCH",
				"export function calculateTotal(items) {",
				"    let total = 0;",
				"=======",
				"export function calculateTotal(items, taxRate = 0) {",
				"    let total = 0;",
				">>>>>>> REPLACE",
			].join("\n")

			const result = await strategy.applyDiff(originalContent, malformedDiff)

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toContain("The diff content appears to be malformed")
				expect(result.error).not.toContain("When removing merge conflict markers")
				expect(result.error).toContain("AI models generate incorrect diff syntax")
			}
		})

		it("provides actionable suggestions for Grok users", () => {
			const diff = "=======\ncontent\n>>>>>>> REPLACE"
			const result = strategy["validateMarkerSequencing"](diff)

			expect(result.error).toContain("Try using the read_file tool first")
			expect(result.error).toContain("Ensure your SEARCH block exactly matches")
			expect(result.error).toContain("Use simpler, smaller diff blocks")
			expect(result.error).toContain("CORRECT FORMAT:")
		})
	})
})
