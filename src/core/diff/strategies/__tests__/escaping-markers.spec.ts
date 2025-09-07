import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../multi-file-search-replace"

describe("Escaping diff markers in content", () => {
	describe("MultiSearchReplaceDiffStrategy", () => {
		let strategy: MultiSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiSearchReplaceDiffStrategy()
		})

		it("should handle escaped equals separator in search content", async () => {
			const originalContent = `function test() {
=======
    return true;
}`
			// Create diff content with escaped marker
			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"function test() {\n" +
				"\\=======\n" +
				"    return true;\n" +
				"}\n" +
				"=======\n" +
				"function test() {\n" +
				"    // Updated comment\n" +
				"    return false;\n" +
				"}\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function test() {
    // Updated comment
    return false;
}`)
			}
		})

		it("should handle escaped search marker in content", async () => {
			const originalContent = `// Example of diff markers
<<<<<<< SEARCH
// This is content`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"// Example of diff markers\n" +
				"\\<<<<<<< SEARCH\n" +
				"// This is content\n" +
				"=======\n" +
				"// Example of diff markers\n" +
				"// [DIFF MARKER REMOVED]\n" +
				"// This is content\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`// Example of diff markers
// [DIFF MARKER REMOVED]
// This is content`)
			}
		})

		it("should handle escaped replace marker in content", async () => {
			const originalContent = `function merge() {
>>>>>>> REPLACE
    return "merged";
}`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"function merge() {\n" +
				"\\>>>>>>> REPLACE\n" +
				'    return "merged";\n' +
				"}\n" +
				"=======\n" +
				"function merge() {\n" +
				"    // Conflict resolved\n" +
				'    return "resolved";\n' +
				"}\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function merge() {
    // Conflict resolved
    return "resolved";
}`)
			}
		})

		it("should handle multiple escaped markers in the same content", async () => {
			const originalContent = `// Git merge conflict example
<<<<<<< HEAD
content from HEAD
=======
content from branch
>>>>>>> feature-branch`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"// Git merge conflict example\n" +
				"\\<<<<<<< HEAD\n" +
				"content from HEAD\n" +
				"\\=======\n" +
				"content from branch\n" +
				"\\>>>>>>> feature-branch\n" +
				"=======\n" +
				"// Git merge conflict resolved\n" +
				"// content merged successfully\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`// Git merge conflict resolved
// content merged successfully`)
			}
		})

		it("should handle escaped dashes separator in content", async () => {
			const originalContent = `function divider() {
-------
    return "divided";
}`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"function divider() {\n" +
				"\\-------\n" +
				'    return "divided";\n' +
				"}\n" +
				"=======\n" +
				"function divider() {\n" +
				"    // Separator line\n" +
				'    return "divided";\n' +
				"}\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function divider() {
    // Separator line
    return "divided";
}`)
			}
		})

		it("should fail when equals marker is not escaped in search content", () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"function test() {\n" +
				"=======\n" +
				"    return true;\n" +
				"}\n" +
				"=======\n" +
				"function test() {\n" +
				"    return false;\n" +
				"}\n" +
				">>>>>>> REPLACE"

			const result = strategy["validateMarkerSequencing"](diff)
			expect(result.success).toBe(false)
			expect(result.error).toContain("The marker '=======' at line")
			expect(result.error).toContain("appears to be part of the content you're trying to edit")
			expect(result.error).toContain("you MUST escape it by adding a backslash")
		})

		it("should fail when search marker is not escaped in content", () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"// Example\n" +
				"<<<<<<< HEAD\n" +
				"// content\n" +
				"=======\n" +
				"// Updated\n" +
				">>>>>>> REPLACE"

			const result = strategy["validateMarkerSequencing"](diff)
			expect(result.success).toBe(false)
			expect(result.error).toContain("appears to be part of the content you're trying to edit")
			expect(result.error).toContain("\\<<<<<<< SEARCH")
		})

		it("should provide helpful error message for unescaped markers", () => {
			// This is actually a valid diff structure, not an error case
			const diff = "<<<<<<< SEARCH\n" + "code with\n" + "=======\n" + "replacement\n" + ">>>>>>> REPLACE"

			const result = strategy["validateMarkerSequencing"](diff)
			expect(result.success).toBe(true) // This is valid
		})

		it("should handle escaped markers in replace content", async () => {
			const originalContent = `function test() {
    return true;
}`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"function test() {\n" +
				"    return true;\n" +
				"}\n" +
				"=======\n" +
				"function test() {\n" +
				"\\=======\n" +
				"\\<<<<<<< SEARCH\n" +
				"\\>>>>>>> REPLACE\n" +
				"    return false;\n" +
				"}\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function test() {
=======
<<<<<<< SEARCH
>>>>>>> REPLACE
    return false;
}`)
			}
		})

		it("should handle real-world merge conflict removal scenario", async () => {
			const originalContent = `function calculate(a, b) {
<<<<<<< HEAD
    return a + b;
=======
    return a * b;
>>>>>>> feature-branch
}`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"function calculate(a, b) {\n" +
				"\\<<<<<<< HEAD\n" +
				"    return a + b;\n" +
				"\\=======\n" +
				"    return a * b;\n" +
				"\\>>>>>>> feature-branch\n" +
				"}\n" +
				"=======\n" +
				"function calculate(a, b) {\n" +
				"    // Resolved: using multiplication\n" +
				"    return a * b;\n" +
				"}\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function calculate(a, b) {
    // Resolved: using multiplication
    return a * b;
}`)
			}
		})
	})

	describe("MultiFileSearchReplaceDiffStrategy", () => {
		let strategy: MultiFileSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiFileSearchReplaceDiffStrategy()
		})

		it("should handle escaped markers in multi-file strategy", async () => {
			const originalContent = `function test() {
=======
    return true;
}`

			const searchBlock =
				"<<<<<<< SEARCH\n" +
				"function test() {\n" +
				"\\=======\n" +
				"    return true;\n" +
				"}\n" +
				"=======\n" +
				"function test() {\n" +
				"    // Updated\n" +
				"    return false;\n" +
				"}\n" +
				">>>>>>> REPLACE"

			const result = await strategy["applySingleDiff"](originalContent, searchBlock)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function test() {
    // Updated
    return false;
}`)
			}
		})

		it("should validate and reject unescaped markers", () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"content with\n" +
				"=======\n" +
				"inside\n" +
				"=======\n" +
				"replacement\n" +
				">>>>>>> REPLACE"

			const result = strategy["validateMarkerSequencing"](diff)
			expect(result.success).toBe(false)
			expect(result.error).toContain("The marker '=======' at line")
			expect(result.error).toContain("appears to be part of the content you're trying to edit")
		})

		it("should handle array of diffs with escaped markers", async () => {
			const originalContent = `function one() {
=======
    return 1;
}

function two() {
<<<<<<< SEARCH
    return 2;
}`

			const diffs = [
				{
					content:
						"<<<<<<< SEARCH\n" +
						"function one() {\n" +
						"\\=======\n" +
						"    return 1;\n" +
						"}\n" +
						"=======\n" +
						"function one() {\n" +
						"    // Separator removed\n" +
						"    return 1;\n" +
						"}\n" +
						">>>>>>> REPLACE",
					startLine: 1,
				},
				{
					content:
						"<<<<<<< SEARCH\n" +
						"function two() {\n" +
						"\\<<<<<<< SEARCH\n" +
						"    return 2;\n" +
						"}\n" +
						"=======\n" +
						"function two() {\n" +
						"    // Marker removed\n" +
						"    return 2;\n" +
						"}\n" +
						">>>>>>> REPLACE",
					startLine: 6,
				},
			]

			const result = await strategy.applyDiff(originalContent, diffs)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.content).toBe(`function one() {
    // Separator removed
    return 1;
}

function two() {
    // Marker removed
    return 2;
}`)
			}
		})
	})

	describe("Error message improvements", () => {
		let strategy: MultiSearchReplaceDiffStrategy

		beforeEach(() => {
			strategy = new MultiSearchReplaceDiffStrategy()
		})

		it("should provide clear guidance when encountering unescaped markers", () => {
			// Test with actual unescaped marker in content
			const diff =
				"<<<<<<< SEARCH\n" +
				"// This code has\n" +
				"=======\n" +
				"// More content\n" +
				"=======\n" + // This extra ======= should trigger an error
				"// Fixed\n" +
				">>>>>>> REPLACE"

			const result = strategy["validateMarkerSequencing"](diff)
			expect(result.success).toBe(false)

			// Check for improved error message components
			expect(result.error).toContain("appears to be part of the content")
			expect(result.error).toContain("MUST escape it")
		})

		it("should distinguish between structural errors and content escaping issues", () => {
			// Structural error (missing SEARCH marker)
			const structuralError = "=======\n" + "content\n" + ">>>>>>> REPLACE"

			const structResult = strategy["validateMarkerSequencing"](structuralError)
			expect(structResult.success).toBe(false)
			expect(structResult.error).toContain("Diff structure is incorrect")
			expect(structResult.error).toContain("CORRECT DIFF STRUCTURE")
			expect(structResult.error).toContain("COMMON ISSUES")

			// Content escaping issue - markers on their own lines
			const escapingError =
				"<<<<<<< SEARCH\n" + "content\n" + "=======\n" + "more content\n" + "=======\n" + ">>>>>>> REPLACE"

			const escapeResult = strategy["validateMarkerSequencing"](escapingError)
			expect(escapeResult.success).toBe(false)
			expect(escapeResult.error).toContain("appears to be part of the content")
			expect(escapeResult.error).toContain("MUST escape it")
		})
	})
})
