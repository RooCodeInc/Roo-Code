import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { ContextBuilder, ContextRequest, ContextType, PriorityType, PriorityItem } from "../context-builder"
import { IMemoryManager } from "../../memory/interfaces"
import { SQLiteAdapter } from "../../memory/storage/sqlite-adapter"

describe("ContextBuilder", () => {
	let memoryManager: IMemoryManager
	let storage: SQLiteAdapter
	let builder: ContextBuilder

	beforeEach(async () => {
		// Create in-memory storage
		storage = new SQLiteAdapter(":memory:", "test_context_builder.db")
		await storage.initialize()

		// Create mock memory manager
		memoryManager = {
			initialize: async () => {},
			shutdown: async () => {},
			getStorage: () => storage,
		}

		// Create context builder
		builder = new ContextBuilder(memoryManager)
		await builder.initialize()
	})

	afterEach(async () => {
		await storage.close()
	})

	describe("buildContext", () => {
		it("should build context with basic request", async () => {
			const request: ContextRequest = {
				query: "test query",
				currentFile: "/test/file.js",
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context).toBeDefined()
			expect(context.totalTokens).toBeGreaterThanOrEqual(0)
			expect(context.items).toBeDefined()
			expect(context.metadata).toBeDefined()
			expect(context.metadata.buildTimeMs).toBeGreaterThanOrEqual(0)
		})

		it("should respect maxTokens limit", async () => {
			const request: ContextRequest = {
				query: "test",
				maxTokens: 100,
			}

			const context = await builder.buildContext(request)

			expect(context.totalTokens).toBeLessThanOrEqual(100)
		})

		it("should include token breakdown", async () => {
			const request: ContextRequest = {
				query: "test",
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context.tokenBreakdown).toBeDefined()
			expect(typeof context.tokenBreakdown[ContextType.CODE]).toBe("number")
			expect(typeof context.tokenBreakdown[ContextType.CONVERSATION]).toBe("number")
		})

		it("should include files in response", async () => {
			const request: ContextRequest = {
				query: "test",
				currentFile: "/test/file.ts",
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context.files).toContain("/test/file.ts")
		})

		it("should track items considered and excluded", async () => {
			const request: ContextRequest = {
				query: "test",
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context.metadata.itemsConsidered).toBeGreaterThanOrEqual(0)
			expect(context.metadata.itemsExcluded).toBeGreaterThanOrEqual(0)
			expect(context.metadata.itemsExcluded).toBeLessThanOrEqual(context.metadata.itemsConsidered)
		})
	})

	describe("getRelevantCode", () => {
		it("should return empty array when no index available", async () => {
			const code = await builder.getRelevantCode("test", "/test/file.js")

			expect(code).toEqual([])
		})

		it("should return relevant code with proper structure", async () => {
			const code = await builder.getRelevantCode("function test", "/test/file.js")

			expect(Array.isArray(code)).toBe(true)
		})
	})

	describe("estimateTokens", () => {
		it("should estimate tokens for empty string", () => {
			const tokens = builder.estimateTokens("")
			expect(tokens).toBe(0)
		})

		it("should estimate tokens for simple text", () => {
			const tokens = builder.estimateTokens("hello world")
			expect(tokens).toBeGreaterThan(0)
		})

		it("should estimate tokens for code", () => {
			const code = `function test() {
				return "hello"
			}`
			const tokens = builder.estimateTokens(code)
			expect(tokens).toBeGreaterThan(0)
		})
	})

	describe("priority items", () => {
		it("should handle empty priority items", async () => {
			const request: ContextRequest = {
				query: "test",
				priorityItems: [],
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context).toBeDefined()
		})

		it("should handle priority items with patterns", async () => {
			const priorityItems: PriorityItem[] = [
				{
					type: PriorityType.PATTERN,
					target: "pattern-id",
					priority: 10,
				},
			]

			const request: ContextRequest = {
				query: "test",
				priorityItems,
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context).toBeDefined()
		})

		it("should handle priority items with decisions", async () => {
			const priorityItems: PriorityItem[] = [
				{
					type: PriorityType.DECISION,
					target: "decision-id",
					priority: 9,
				},
			]

			const request: ContextRequest = {
				query: "test",
				priorityItems,
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context).toBeDefined()
		})
	})

	describe("context types", () => {
		it("should have all context types defined", () => {
			expect(ContextType.CODE).toBe("code")
			expect(ContextType.CONVERSATION).toBe("conversation")
			expect(ContextType.PATTERN).toBe("pattern")
			expect(ContextType.DECISION).toBe("decision")
			expect(ContextType.ARCHITECTURE).toBe("architecture")
			expect(ContextType.BEHAVIOR).toBe("behavior")
			expect(ContextType.SYMBOL).toBe("symbol")
		})

		it("should have all priority types defined", () => {
			expect(PriorityType.FILE).toBe("file")
			expect(PriorityType.PATTERN).toBe("pattern")
			expect(PriorityType.DECISION).toBe("decision")
			expect(PriorityType.CONVERSATION).toBe("conversation")
			expect(PriorityType.SYMBOL).toBe("symbol")
		})
	})

	describe("metadata", () => {
		it("should include compression metadata when items are compressed", async () => {
			const request: ContextRequest = {
				query: "test",
				maxTokens: 100,
			}

			const context = await builder.buildContext(request)

			expect(context.metadata.compressionApplied).toBeDefined()
			expect(context.metadata.originalTokens).toBeDefined()
		})

		it("should have valid build time", async () => {
			const request: ContextRequest = {
				query: "test",
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			// Build time should be reasonable (less than 5 seconds)
			expect(context.metadata.buildTimeMs).toBeLessThan(5000)
			expect(context.metadata.buildTimeMs).toBeGreaterThanOrEqual(0)
		})
	})

	describe("exclude types", () => {
		it("should handle exclude types", async () => {
			const request: ContextRequest = {
				query: "test",
				excludeTypes: [ContextType.CODE, ContextType.CONVERSATION],
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context).toBeDefined()
		})
	})

	describe("open files", () => {
		it("should track open files", async () => {
			const request: ContextRequest = {
				query: "test",
				openFiles: ["/file1.js", "/file2.ts", "/file3.py"],
				maxTokens: 4000,
			}

			const context = await builder.buildContext(request)

			expect(context).toBeDefined()
		})
	})

	describe("large context", () => {
		it("should handle large maxTokens value", async () => {
			const request: ContextRequest = {
				query: "test",
				maxTokens: 32000,
			}

			const context = await builder.buildContext(request)

			expect(context.totalTokens).toBeLessThanOrEqual(32000)
		})
	})
})
