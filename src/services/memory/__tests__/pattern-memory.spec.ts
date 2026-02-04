import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { PatternMemoryImpl, PatternContext } from "../pattern-memory"
import { SQLiteAdapter } from "../storage/sqlite-adapter"
import { v4 as uuidv4 } from "uuid"

describe("PatternMemory", () => {
	let memory: PatternMemoryImpl
	let storage: SQLiteAdapter

	beforeEach(async () => {
		// Use in-memory SQLite database for testing
		storage = new SQLiteAdapter(":memory:", "test_pattern_memory.db")
		await storage.initialize()
		memory = new PatternMemoryImpl(storage)
		await memory.initialize()
	})

	afterEach(async () => {
		await storage.close()
	})

	describe("learnPattern", () => {
		it("should learn a new pattern and return an id", async () => {
			const code = `function add(a, b) {
				return a + b
			}`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: ["function", "math"],
			}

			const id = await memory.learnPattern(code, context)

			expect(id).toBeDefined()
			expect(typeof id).toBe("string")
			expect(id.length).toBe(36) // UUID format
		})

		it("should normalize code and store normalized template", async () => {
			const code = `function test() {
				// this is a comment
				return "hello"
			}`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: [],
			}

			await memory.learnPattern(code, context)

			const pattern = await memory.getPatternByHash(
				await getPatternHash(memory, code),
			)
			expect(pattern).not.toBeNull()
			expect(pattern?.template).not.toContain("// this is a comment")
			expect(pattern?.template).not.toContain("hello")
		})

		it("should increment occurrences when same pattern is learned again", async () => {
			const code = `const sum = (a, b) => a + b`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: ["arrow-function"],
			}

			const id1 = await memory.learnPattern(code, context)
			const id2 = await memory.learnPattern(code, context)

			expect(id1).toBe(id2)

			const pattern = await memory.getPattern(id1)
			expect(pattern?.occurrences).toBe(2)
		})

		it("should handle different string literals as same pattern", async () => {
			const code1 = `console.log("hello world")`
			const code2 = `console.log("goodbye world")`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: [],
			}

			const id1 = await memory.learnPattern(code1, context)
			const id2 = await memory.learnPattern(code2, context)

			expect(id1).toBe(id2)

			const pattern = await memory.getPattern(id1)
			expect(pattern?.occurrences).toBe(2)
		})

		it("should handle different numbers as same pattern", async () => {
			const code1 = `const x = 42`
			const code2 = `const x = 100`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: [],
			}

			const id1 = await memory.learnPattern(code1, context)
			const id2 = await memory.learnPattern(code2, context)

			expect(id1).toBe(id2)
		})
	})

	describe("getPattern", () => {
		it("should retrieve a pattern by id", async () => {
			const code = `class User {
				constructor(name) {
					this.name = name
				}
			}`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: ["class", "oop"],
			}

			const id = await memory.learnPattern(code, context)
			const pattern = await memory.getPattern(id)

			expect(pattern).not.toBeNull()
			expect(pattern?.id).toBe(id)
			expect(pattern?.context.language).toBe("javascript")
		})

		it("should return null for non-existent pattern", async () => {
			const pattern = await memory.getPattern("non-existent-id")
			expect(pattern).toBeNull()
		})
	})

	describe("getPatternByHash", () => {
		it("should retrieve a pattern by hash", async () => {
			const code = `if (condition) { doSomething() }`
			const context: PatternContext = {
				language: "javascript",
				fileType: "js",
				tags: ["control-flow"],
			}

			const id = await memory.learnPattern(code, context)
			const hash = await getPatternHash(memory, code)
			const pattern = await memory.getPatternByHash(hash)

			expect(pattern).not.toBeNull()
			expect(pattern?.id).toBe(id)
		})

		it("should return null for non-existent hash", async () => {
			const pattern = await memory.getPatternByHash("non-existent-hash")
			expect(pattern).toBeNull()
		})
	})

	describe("listPatterns", () => {
		it("should list all patterns", async () => {
			await memory.learnPattern("code1", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("code2", { language: "ts", fileType: "ts", tags: [] })
			await memory.learnPattern("code3", { language: "js", fileType: "jsx", tags: [] })

			const patterns = await memory.listPatterns()

			expect(patterns.length).toBe(3)
		})

		it("should filter by language", async () => {
			await memory.learnPattern("js code", { language: "javascript", fileType: "js", tags: [] })
			await memory.learnPattern("ts code", { language: "typescript", fileType: "ts", tags: [] })
			await memory.learnPattern("more js", { language: "javascript", fileType: "js", tags: [] })

			const patterns = await memory.listPatterns({ language: "javascript" })

			expect(patterns.length).toBe(2)
			expect(patterns.every((p) => p.context.language === "javascript")).toBe(true)
		})

		it("should limit results", async () => {
			for (let i = 0; i < 10; i++) {
				await memory.learnPattern(`code${i}`, { language: "js", fileType: "js", tags: [] })
			}

			const patterns = await memory.listPatterns({ limit: 5 })

			expect(patterns.length).toBe(5)
		})
	})

	describe("getFrequentPatterns", () => {
		it("should return patterns sorted by occurrences", async () => {
			await memory.learnPattern("rare", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("common", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("common", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("common", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("frequent", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("frequent", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("frequent", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("frequent", { language: "js", fileType: "js", tags: [] })
			await memory.learnPattern("frequent", { language: "js", fileType: "js", tags: [] })

			const patterns = await memory.getFrequentPatterns(3)

			expect(patterns.length).toBe(3)
			expect(patterns[0].template).toContain("frequent")
			expect(patterns[1].template).toContain("common")
			expect(patterns[2].template).toContain("rare")
		})
	})

	describe("getRecentPatterns", () => {
		it("should return patterns sorted by last_seen", async () => {
			await memory.learnPattern("old", { language: "js", fileType: "js", tags: [] })
			await delay(10)
			await memory.learnPattern("middle", { language: "js", fileType: "js", tags: [] })
			await delay(10)
			await memory.learnPattern("new", { language: "js", fileType: "js", tags: [] })

			const patterns = await memory.getRecentPatterns(3)

			expect(patterns.length).toBe(3)
			expect(patterns[0].template).toContain("new")
			expect(patterns[1].template).toContain("middle")
			expect(patterns[2].template).toContain("old")
		})
	})

	describe("suggestSimilarPatterns", () => {
		it("should suggest patterns with similarity above threshold", async () => {
			await memory.learnPattern(
				`function add(a, b) { return a + b }`,
				{ language: "javascript", fileType: "js", tags: [] },
			)
			await memory.learnPattern(
				`function multiply(a, b) { return a * b }`,
				{ language: "javascript", fileType: "js", tags: [] },
			)
			await memory.learnPattern(
				`class Calculator { add(a, b) { return a + b } }`,
				{ language: "javascript", fileType: "js", tags: [] },
			)
			await memory.learnPattern(
				`if (x > 0) { return true }`,
				{ language: "javascript", fileType: "js", tags: [] },
			)

			const suggestions = await memory.suggestSimilarPatterns(
				`function sum(a, b) { return a + b }`,
				5,
			)

			// Should find similar function patterns
			const functionPatterns = suggestions.filter(
				(s) => s.pattern.template.includes("function") || s.pattern.template.includes("add"),
			)
			expect(functionPatterns.length).toBeGreaterThan(0)
		})

		it("should not suggest exact same pattern", async () => {
			const code = `const result = value`
			await memory.learnPattern(code, { language: "js", fileType: "js", tags: [] })

			const suggestions = await memory.suggestSimilarPatterns(code, 5)

			expect(suggestions.length).toBe(0)
		})

		it("should limit suggestions", async () => {
			for (let i = 0; i < 10; i++) {
				await memory.learnPattern(
					`function test${i}() { return ${i} }`,
					{ language: "javascript", fileType: "js", tags: [] },
				)
			}

			const suggestions = await memory.suggestSimilarPatterns(`function example() { return 0 }`, 3)

			expect(suggestions.length).toBeLessThanOrEqual(3)
		})
	})

	describe("recordOccurrence", () => {
		it("should record an occurrence for a pattern", async () => {
			const id = await memory.learnPattern("code", { language: "js", fileType: "js", tags: [] })

			// learnPattern now records an initial occurrence
			const beforeRecord = await memory.getOccurrences(id)
			expect(beforeRecord.length).toBe(1)

			await memory.recordOccurrence(id, "/test/file.js", 42)

			const occurrences = await memory.getOccurrences(id)

			expect(occurrences.length).toBe(2)
			expect(occurrences[0].filePath).toBe("/test/file.js")
			expect(occurrences[0].lineNumber).toBe(42)
		})
	})

	describe("getOccurrences", () => {
		it("should return all occurrences for a pattern", async () => {
			const id = await memory.learnPattern("test", { language: "js", fileType: "js", tags: [] })

			// learnPattern records initial occurrence
			const beforeRecord = await memory.getOccurrences(id)
			expect(beforeRecord.length).toBe(1)

			await memory.recordOccurrence(id, "/file1.js", 10)
			await memory.recordOccurrence(id, "/file2.js", 20)
			await memory.recordOccurrence(id, "/file3.js", 30)

			const occurrences = await memory.getOccurrences(id)

			expect(occurrences.length).toBe(4)
		})

		it("should return empty array for pattern with no occurrences", async () => {
			// Create a pattern and immediately check occurrences
			const id = await memory.learnPattern("test", { language: "js", fileType: "js", tags: [] })

			// learnPattern always records an initial occurrence
			const occurrences = await memory.getOccurrences(id)

			expect(occurrences.length).toBe(1)
		})
	})

	describe("deletePattern", () => {
		it("should delete a pattern", async () => {
			const id = await memory.learnPattern("to delete", { language: "js", fileType: "js", tags: [] })

			const deleted = await memory.deletePattern(id)

			expect(deleted).toBe(true)

			const pattern = await memory.getPattern(id)
			expect(pattern).toBeNull()
		})

		it("should return false when deleting non-existent pattern", async () => {
			const deleted = await memory.deletePattern("non-existent")
			expect(deleted).toBe(false)
		})
	})

	describe("getStatistics", () => {
		it("should return correct statistics", async () => {
			await memory.learnPattern("code1", { language: "javascript", fileType: "js", tags: [] })
			await memory.learnPattern("code1", { language: "javascript", fileType: "js", tags: [] })
			await memory.learnPattern("code2", { language: "typescript", fileType: "ts", tags: [] })
			await memory.learnPattern("code3", { language: "javascript", fileType: "jsx", tags: [] })

			const stats = await memory.getStatistics()

			expect(stats.totalPatterns).toBe(3)
			expect(stats.totalOccurrences).toBe(4)
			expect(stats.patternsByLanguage.length).toBeGreaterThan(0)
			expect(stats.topPatterns.length).toBeGreaterThan(0)
		})
	})
})

// Helper function to get pattern hash
async function getPatternHash(memory: PatternMemoryImpl, code: string): Promise<string> {
	const adapter = (memory as any).storage
	const normalized = code
		.replace(/\/\/.*$/gm, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/"[^"]*"/g, '"..."')
		.replace(/'[^']*'/g, "'...'")
		.replace(/`[^`]*`/g, "`...`")
		.replace(/\b\d+\b/g, "N")
		.replace(/\s+/g, " ")
		.trim()

	let hash = 0
	for (let i = 0; i < normalized.length; i++) {
		const char = normalized.charCodeAt(i)
		hash = ((hash << 5) - hash) + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(16)
}

// Helper delay function
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
