/**
 * Context Compressor V2 Tests
 *
 * Tests for the advanced context compression functionality.
 */

import { describe, it, expect, beforeEach } from "vitest"
import type { BuiltContext, ContextItem, ContextType } from "../context-builder"
import { ContextCompressorV2, createContextCompressorV2 } from "../context-compressor-v2"

describe("ContextCompressorV2", () => {
	let compressor: ContextCompressorV2

	beforeEach(() => {
		compressor = new ContextCompressorV2()
	})

	describe("constructor", () => {
		it("should create a new instance", () => {
			expect(compressor).toBeInstanceOf(ContextCompressorV2)
		})

		it("should create instance using factory function", () => {
			const factoryCompressor = createContextCompressorV2()
			expect(factoryCompressor).toBeInstanceOf(ContextCompressorV2)
		})
	})

	describe("compress", () => {
		function createMockContext(
			items: ContextItem[],
			totalTokens: number,
		): BuiltContext {
			return {
				items,
				totalTokens,
				tokenBreakdown: {} as Record<ContextType, number>,
				files: [],
				metadata: {
					buildTimeMs: 100,
					itemsConsidered: items.length,
					itemsExcluded: 0,
					compressionApplied: false,
					originalTokens: totalTokens,
				},
			}
		}

		function createMockItem(
			type: ContextType,
			content: string,
			source: string,
			relevance: number = 0.5,
			priority: number = 5,
		): ContextItem {
			return {
				type,
				content,
				tokens: Math.ceil(content.length / 4),
				source,
				relevance,
				priority,
			}
		}

		it("should return no compression needed when content fits", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "function test() { return 42; }", "/test.ts"),
			]
			const context = createMockContext(items, 10)
			const result = await compressor.compress(context, 100)

			expect(result.stage).toBe(0)
			expect(result.compressionRatio).toBe(0)
		})

		it("should remove low-priority items in stage 1", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "important code", "/test.ts", 0.9, 8),
				createMockItem("code" as ContextType, "low priority code", "/test2.ts", 0.1, 1),
				createMockItem("conversation" as ContextType, "old chat", "/chat", 0.1, 2),
			]
			const context = createMockContext(items, 100)
			const result = await compressor.compress(context, 50)

			expect(result.stage).toBeGreaterThanOrEqual(1)
			expect(result.context.items.length).toBeLessThanOrEqual(items.length)
		})

		it("should preserve critical types during compression", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "important code", "/test.ts", 0.9, 8),
				createMockItem("pattern" as ContextType, "pattern info", "/pattern", 0.1, 1),
				createMockItem("decision" as ContextType, "decision info", "/decision", 0.1, 1),
			]
			const context = createMockContext(items, 200)
			const result = await compressor.compress(context, 50)

			// Code items should be preserved as critical type
			const codeItems = result.context.items.filter((i) => i.type === "code")
			expect(codeItems.length).toBeGreaterThanOrEqual(1)
		})

		it("should handle empty context", async () => {
			const context: BuiltContext = {
				items: [],
				totalTokens: 0,
				tokenBreakdown: {} as Record<ContextType, number>,
				files: [],
				metadata: {
					buildTimeMs: 0,
					itemsConsidered: 0,
					itemsExcluded: 0,
					compressionApplied: false,
					originalTokens: 0,
				},
			}
			const result = await compressor.compress(context, 100)

			expect(result.context.items).toHaveLength(0)
			expect(result.compressionRatio).toBe(0)
		})

		it("should handle large context with multiple items", async () => {
			const items: ContextItem[] = []
			for (let i = 0; i < 20; i++) {
				const typeMap: ContextType[] = ["code", "conversation", "pattern"]
				items.push(
					createMockItem(
						typeMap[i % 3],
						`content ${i}`.repeat(50),
						`/file${i}.ts`,
						Math.random(),
						Math.floor(Math.random() * 10) + 1,
					),
				)
			}
			const context = createMockContext(items, 5000)
			const result = await compressor.compress(context, 500)

			expect(result.context.totalTokens).toBeLessThanOrEqual(500)
			expect(result.stage).toBeGreaterThanOrEqual(1)
		})

		it("should respect custom compression options", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "code", "/test.ts", 0.5, 5),
				createMockItem("pattern" as ContextType, "pattern", "/pattern", 0.5, 5),
			]
			const context = createMockContext(items, 100)
			const result = await compressor.compress(context, 50, {
				minPriority: 8,
				maxItemsPerType: 1,
				summarizeThreshold: 100,
				preserveCritical: true,
				criticalTypes: ["code", "pattern"] as ContextType[],
			})

			expect(result.stage).toBeGreaterThanOrEqual(1)
		})

		it("should return valid compression ratio", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "x".repeat(1000), "/test.ts", 0.5, 5),
			]
			const context = createMockContext(items, 250)
			const result = await compressor.compress(context, 100)

			expect(result.compressionRatio).toBeGreaterThanOrEqual(0)
			expect(result.compressionRatio).toBeLessThanOrEqual(1)
			expect(result.originalTokens).toBe(250)
		})
	})

	describe("quickCompress", () => {
		function createMockContext(
			items: ContextItem[],
			totalTokens: number,
		): BuiltContext {
			return {
				items,
				totalTokens,
				tokenBreakdown: {} as Record<ContextType, number>,
				files: [],
				metadata: {
					buildTimeMs: 100,
					itemsConsidered: items.length,
					itemsExcluded: 0,
					compressionApplied: false,
					originalTokens: totalTokens,
				},
			}
		}

		function createMockItem(
			type: ContextType,
			content: string,
			source: string,
		): ContextItem {
			return {
				type,
				content,
				tokens: Math.ceil(content.length / 4),
				source,
				relevance: 0.5,
				priority: 5,
			}
		}

		it("should compress with default options", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "test", "/test.ts"),
			]
			const context = createMockContext(items, 5)
			const result = await compressor.quickCompress(context, 100)

			expect(result).toBeDefined()
			expect(result.context).toBeDefined()
		})
	})

	describe("getCompressionStats", () => {
		function createMockContext(
			items: ContextItem[],
			totalTokens: number,
		): BuiltContext {
			return {
				items,
				totalTokens,
				tokenBreakdown: {} as Record<ContextType, number>,
				files: [],
				metadata: {
					buildTimeMs: 100,
					itemsConsidered: items.length,
					itemsExcluded: 0,
					compressionApplied: false,
					originalTokens: totalTokens,
				},
			}
		}

		function createMockItem(
			type: ContextType,
			content: string,
			source: string,
		): ContextItem {
			return {
				type,
				content,
				tokens: Math.ceil(content.length / 4),
				source,
				relevance: 0.5,
				priority: 5,
			}
		}

		it("should return canCompress=false when content fits", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "test", "/test.ts"),
			]
			const context = createMockContext(items, 10)
			const stats = await compressor.getCompressionStats(context, 100)

			expect(stats.canCompress).toBe(false)
			expect(stats.estimatedRatio).toBe(0)
			expect(stats.stages).toHaveLength(0)
		})

		it("should return canCompress=true when content exceeds limit", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "x".repeat(1000), "/test.ts"),
			]
			const context = createMockContext(items, 250)
			const stats = await compressor.getCompressionStats(context, 100)

			expect(stats.canCompress).toBe(true)
			expect(stats.estimatedRatio).toBeGreaterThan(0)
			expect(stats.stages.length).toBeGreaterThan(0)
		})

		it("should limit estimated ratio to 0.9", async () => {
			const items: ContextItem[] = [
				createMockItem("code" as ContextType, "x".repeat(10000), "/test.ts"),
			]
			const context = createMockContext(items, 2500)
			const stats = await compressor.getCompressionStats(context, 10)

			expect(stats.estimatedRatio).toBeLessThanOrEqual(0.9)
		})
	})

	describe("edge cases", () => {
		function createMockContext(
			items: ContextItem[],
			totalTokens: number,
		): BuiltContext {
			return {
				items,
				totalTokens,
				tokenBreakdown: {} as Record<ContextType, number>,
				files: [],
				metadata: {
					buildTimeMs: 100,
					itemsConsidered: items.length,
					itemsExcluded: 0,
					compressionApplied: false,
					originalTokens: totalTokens,
				},
			}
		}

		it("should handle context with zero tokens", async () => {
			const context: BuiltContext = {
				items: [],
				totalTokens: 0,
				tokenBreakdown: {} as Record<ContextType, number>,
				files: [],
				metadata: {
					buildTimeMs: 0,
					itemsConsidered: 0,
					itemsExcluded: 0,
					compressionApplied: false,
					originalTokens: 0,
				},
			}
			const result = await compressor.compress(context, 100)

			expect(result.compressionRatio).toBe(0)
			expect(result.compressedTokens).toBe(0)
		})

		it("should handle extremely large maxTokens", async () => {
			const items: ContextItem[] = [
				{
					type: "code" as ContextType,
					content: "test",
					tokens: 5,
					source: "/test.ts",
					relevance: 0.5,
					priority: 5,
				},
			]
			const context = createMockContext(items, 5)
			const result = await compressor.compress(context, 1000000)

			expect(result.stage).toBe(0)
			expect(result.compressionRatio).toBe(0)
		})

		it("should handle maxTokens of 0", async () => {
			const items: ContextItem[] = [
				{
					type: "code" as ContextType,
					content: "test",
					tokens: 5,
					source: "/test.ts",
					relevance: 0.5,
					priority: 5,
				},
			]
			const context = createMockContext(items, 5)
			const result = await compressor.compress(context, 0)

			// Should attempt compression even with 0 maxTokens
			expect(result.stage).toBeGreaterThanOrEqual(1)
		})

		it("should handle items with empty content", async () => {
			const items: ContextItem[] = [
				{
					type: "code" as ContextType,
					content: "",
					tokens: 0,
					source: "/test.ts",
					relevance: 0.5,
					priority: 5,
				},
				{
					type: "conversation" as ContextType,
					content: "x".repeat(100),
					tokens: 25,
					source: "/chat",
					relevance: 0.1,
					priority: 1,
				},
			]
			const context = createMockContext(items, 25)
			const result = await compressor.compress(context, 10)

			expect(result.context.items.length).toBeLessThanOrEqual(items.length)
		})

		it("should handle all context types", async () => {
		const types: ContextType[] = ["code", "conversation", "pattern", "decision", "architecture", "behavior", "symbol"] as ContextType[]
			const items: ContextItem[] = types.map((type, i) => ({
				type,
				content: `content for ${type}`,
				tokens: 5,
				source: `/file${i}.ts`,
				relevance: 0.5,
				priority: 5,
			}))
			const context = createMockContext(items, 35)
			const result = await compressor.compress(context, 10)

			// Should handle all types without errors
			expect(result.context.items).toBeDefined()
		})
	})
})
