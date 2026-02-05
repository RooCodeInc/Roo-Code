import { describe, it, expect, beforeEach } from "vitest"
import { PatternTracker } from "../pattern-tracker"
import { PatternContext } from "../types"

describe("PatternTracker", () => {
	let tracker: PatternTracker
	let mockContext: PatternContext

	beforeEach(() => {
		tracker = new PatternTracker()
		mockContext = {
			filePath: "/src/test.ts",
			line: 10,
			language: "typescript",
			scope: "test",
		}
	})

	it("should track a new pattern", async () => {
		const code = "const x = 1; if (x > 0) { console.log(x); }"
		await tracker.trackPattern(code, mockContext)

		const patterns = tracker.getTopPatterns()
		expect(patterns).toHaveLength(1)
		expect(patterns[0].occurrences).toBe(1)
		expect(patterns[0].metadata?.category).toBe("code_block")
	})

	it("should increment occurrences for identical patterns", async () => {
		const code = "const x = 1;"
		await tracker.trackPattern(code, mockContext)
		await tracker.trackPattern(code, { ...mockContext, line: 20 })

		const patterns = tracker.getTopPatterns()
		expect(patterns).toHaveLength(1)
		expect(patterns[0].occurrences).toBe(2)
	})

	it("should normalize code (ignore whitespace)", async () => {
		const code1 = "if (x) { return true; }"
		const code2 = "if (x) {   return true;   }"
		
		await tracker.trackPattern(code1, mockContext)
		await tracker.trackPattern(code2, { ...mockContext, line: 20 })

		const patterns = tracker.getTopPatterns()
		expect(patterns).toHaveLength(1) // Should be considered same pattern
		expect(patterns[0].occurrences).toBe(2)
	})

	it("should categorize patterns correctly", async () => {
		const classCode = "class MyClass { constructor() {} }"
		await tracker.trackPattern(classCode, mockContext)

		const patterns = tracker.getTopPatterns()
		const classPattern = patterns.find(p => p.metadata?.category === "class_definition")
		expect(classPattern).toBeDefined()
	})

	it("should finding similar patterns", async () => {
		// Since we use a mock embedding based on char codes:
		// "abc" should be similar to "abd" (close char codes)
		// "xyz" should be far from "abc"
		
		const code1 = "function test() { return true; }"
		const code2 = "function test() { return false; }" // Very similar
		
		await tracker.trackPattern(code1, mockContext)
		
		const suggestions = await tracker.suggestSimilarPatterns(code2)
		// Expect high similarity score
		expect(suggestions.length).toBeGreaterThan(0)
		expect(suggestions[0].similarity).toBeGreaterThan(0.9)
	})

	it("should ignore short snippets", async () => {
		const shortCode = "x = 1"
		await tracker.trackPattern(shortCode, mockContext)
		
		const patterns = tracker.getTopPatterns()
		expect(patterns).toHaveLength(0)
	})
})
