import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("MultiSearchReplaceDiffStrategy - Issue #8020", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy()
	})

	it("should strip line numbers from last line without trailing newline", async () => {
		// This reproduces the exact issue from #8020
		// The problem was that the regex was removing the trailing newline,
		// which caused stripLineNumbers to fail on the last line
		const originalContent = "line 1\nline 2\nline 3"

		// Diff content with line numbers on every line including the last
		const diffContent = `<<<<<<< SEARCH
1 | line 1
2 | line 2
3 | line 3
=======
1 | line 1
2 | modified
3 | line 3
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		if (!result.success) {
			console.error("Failed with:", result.error || result.failParts)
		}

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe("line 1\nmodified\nline 3")
		}
	})

	it("should handle the exact case from issue #8020", async () => {
		// Simplified version of the actual case
		const originalContent = "some code);"

		const diffContent = `<<<<<<< SEARCH
1479 | some code);
=======
1488 | some code);
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)

		if (!result.success) {
			console.error("Failed with:", result.error || result.failParts)
		}

		expect(result.success).toBe(true)
		if (result.success) {
			// Content should remain the same since we're just replacing with the same
			expect(result.content).toBe("some code);")
		}
	})
})
