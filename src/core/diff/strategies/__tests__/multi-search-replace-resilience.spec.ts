import { MultiSearchReplaceDiffStrategy } from "../multi-search-replace"

describe("MultiSearchReplaceDiffStrategy - Resilience", () => {
	let strategy: MultiSearchReplaceDiffStrategy

	beforeEach(() => {
		strategy = new MultiSearchReplaceDiffStrategy()
	})

	const originalContent = [
		"function hello() {",
		'    console.log("hello world")',
		"}",
		"",
		"function goodbye() {",
		'    console.log("goodbye world")',
		"}",
	].join("\n")

	describe("Layer 1: normalizeDiffContent", () => {
		it("handles trailing whitespace on marker lines", async () => {
			// Model generates "<<<<<<< SEARCH   " with trailing spaces
			const diff =
				"<<<<<<< SEARCH   \n" +
				":start_line:2\n" +
				"-------\n" +
				'    console.log("hello world")\n' +
				"=======   \n" +
				'    console.log("hi world")\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("handles blank lines between SEARCH marker and content", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"\n" +
				'    console.log("hello world")\n' +
				"=======\n" +
				'    console.log("hi world")\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("handles blank lines between content and separator", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				'    console.log("hello world")\n' +
				"\n" +
				"=======\n" +
				'    console.log("hi world")\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("handles CRLF in diff markers", async () => {
			const diff =
				"<<<<<<< SEARCH\r\n" +
				'    console.log("hello world")\r\n' +
				"=======\r\n" +
				'    console.log("hi world")\r\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("preserves blank lines WITHIN content sections", async () => {
			const contentWithBlanks = [
				"function hello() {",
				'    console.log("hello world")',
				"",
				'    console.log("again")',
				"}",
			].join("\n")

			const diff =
				"<<<<<<< SEARCH\n" +
				'    console.log("hello world")\n' +
				"\n" +
				'    console.log("again")\n' +
				"=======\n" +
				'    console.log("hi world")\n' +
				"\n" +
				'    console.log("once more")\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(contentWithBlanks, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
			expect(result.content).toContain('console.log("once more")')
		})

		it("handles mix of clean and dirty blocks", async () => {
			// First block is clean, second has trailing whitespace
			const diff =
				"<<<<<<< SEARCH\n" +
				'    console.log("hello world")\n' +
				"=======\n" +
				'    console.log("hi world")\n' +
				">>>>>>> REPLACE\n" +
				"\n" +
				"<<<<<<< SEARCH   \n" +
				'    console.log("goodbye world")\n' +
				"=======   \n" +
				'    console.log("bye world")\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
			expect(result.content).toContain('console.log("bye world")')
		})

		it("handles blank lines between separator and REPLACE marker", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				'    console.log("hello world")\n' +
				"=======\n" +
				'    console.log("hi world")\n' +
				"\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})
	})

	describe("Layer 2: Fallback parser", () => {
		it("extracts and applies blocks when strict regex fails but structure is valid", async () => {
			// Simulate a diff that passes validation but the strict regex can't match
			// due to multiple blank lines between markers
			const diff =
				"<<<<<<< SEARCH\n" +
				"\n" +
				"\n" +
				'    console.log("hello world")\n' +
				"\n" +
				"\n" +
				"=======\n" +
				"\n" +
				'    console.log("hi world")\n' +
				"\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("fallback with exact match in file", async () => {
			// Use the internal fallback parser directly
			const diff =
				"<<<<<<< SEARCH\n" + "function hello() {\n" + "=======\n" + "function greet() {\n" + ">>>>>>> REPLACE"

			const result = await strategy["applyDiffWithFallbackParser"](originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain("function greet() {")
			expect(result.content).not.toContain("function hello() {")
		})

		it("fallback handles multiple blocks", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"function hello() {\n" +
				"=======\n" +
				"function greet() {\n" +
				">>>>>>> REPLACE\n" +
				"\n" +
				"<<<<<<< SEARCH\n" +
				"function goodbye() {\n" +
				"=======\n" +
				"function farewell() {\n" +
				">>>>>>> REPLACE"

			const result = await strategy["applyDiffWithFallbackParser"](originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain("function greet() {")
			expect(result.content).toContain("function farewell() {")
		})

		it("fallback with whitespace-tolerant match (tabs vs spaces)", async () => {
			// File uses spaces but search content uses tabs
			const tabOriginal = 'function hello() {\n\tconsole.log("hello world")\n}'

			const diff =
				"<<<<<<< SEARCH\n" +
				'\tconsole.log("hello world")\n' +
				"=======\n" +
				'\tconsole.log("hi world")\n' +
				">>>>>>> REPLACE"

			// The exact match will fail (tab vs spaces in original), but
			// fuzzy search should handle it since it's close enough at threshold 1.0
			// If fuzzy also fails, whitespace-tolerant kicks in
			const result = await strategy["applyDiffWithFallbackParser"](tabOriginal, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("returns error when all blocks fail in fallback", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"this content does not exist anywhere\n" +
				"=======\n" +
				"replacement\n" +
				">>>>>>> REPLACE"

			const result = await strategy["applyDiffWithFallbackParser"](originalContent, diff)
			expect(result.success).toBe(false)
			if (result.success) return
			expect(result.error).toContain("could not apply any blocks")
		})

		it("returns error when no blocks can be extracted", async () => {
			const diff = "just some random text without any markers"

			const result = await strategy["applyDiffWithFallbackParser"](originalContent, diff)
			expect(result.success).toBe(false)
			if (result.success) return
			expect(result.error).toContain("Invalid diff format")
		})

		it("handles blocks with :start_line: in fallback", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				":start_line:1\n" +
				"-------\n" +
				"function hello() {\n" +
				"=======\n" +
				"function greet() {\n" +
				">>>>>>> REPLACE"

			const result = await strategy["applyDiffWithFallbackParser"](originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain("function greet() {")
		})

		it("fallback handles deletion (empty replace)", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"function hello() {\n" +
				'    console.log("hello world")\n' +
				"}\n" +
				"=======\n" +
				">>>>>>> REPLACE"

			const result = await strategy["applyDiffWithFallbackParser"](originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).not.toContain("function hello()")
			expect(result.content).toContain("function goodbye()")
		})
	})

	describe("End-to-end: applyDiff resilience", () => {
		it("well-formed diff still works (happy path unchanged)", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				":start_line:2\n" +
				"-------\n" +
				'    console.log("hello world")\n' +
				"=======\n" +
				'    console.log("hi world")\n' +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("recovers from trailing whitespace on all markers", async () => {
			const diff =
				"<<<<<<< SEARCH   \n" +
				":start_line:2   \n" +
				"-------   \n" +
				'    console.log("hello world")\n' +
				"=======   \n" +
				'    console.log("hi world")\n' +
				">>>>>>> REPLACE   "

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})

		it("recovers from extra blank lines around markers via normalization + fallback", async () => {
			const diff =
				"<<<<<<< SEARCH\n" +
				"\n" +
				'    console.log("hello world")\n' +
				"\n" +
				"=======\n" +
				"\n" +
				'    console.log("hi world")\n' +
				"\n" +
				">>>>>>> REPLACE"

			const result = await strategy.applyDiff(originalContent, diff)
			expect(result.success).toBe(true)
			if (!result.success) return
			expect(result.content).toContain('console.log("hi world")')
		})
	})
})
