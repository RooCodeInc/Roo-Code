import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("MultiSearchReplaceDiffStrategy - Simple Line Number Test", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy()
	})

	it("should handle simple line number stripping", async () => {
		const originalContent = "line 1\nline 2\nline 3"
		const diffContent = `<<<<<<< SEARCH
1 | line 1
2 | line 2
3 | line 3
=======
1 | line 1
2 | modified line 2
3 | line 3
>>>>>>> REPLACE`

		const result = await strategy.applyDiff(originalContent, diffContent)
		console.log("Result:", result)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.content).toBe("line 1\nmodified line 2\nline 3")
		}
	})
})
