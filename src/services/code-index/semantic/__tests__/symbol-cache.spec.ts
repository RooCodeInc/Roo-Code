/**
 * SymbolCache Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SymbolCache } from "../symbol-cache"
import { ResolvedSymbol } from "../interfaces"

describe("SymbolCache", () => {
	let cache: SymbolCache

	const createMockSymbol = (name: string, filePath: string): ResolvedSymbol => ({
		name,
		type: "function",
		scope: "module",
		position: { line: 1, column: 0 },
		references: [],
		filePath,
		definitionRange: {
			start: { line: 1, column: 0 },
			end: { line: 5, column: 1 },
		},
		isExported: true,
	})

	beforeEach(() => {
		cache = new SymbolCache(100, 60000) // 100 items, 1 minute TTL
	})

	afterEach(() => {
		cache.clear()
	})

	describe("get and set", () => {
		it("should store and retrieve symbols", () => {
			const symbol = createMockSymbol("testFunc", "/test/file.ts")

			cache.set("testFunc", "/test/file.ts", symbol)
			const retrieved = cache.get("testFunc", "/test/file.ts")

			expect(retrieved).toBeDefined()
			expect(retrieved?.name).toBe("testFunc")
		})

		it("should return undefined for non-existent symbols", () => {
			const result = cache.get("nonExistent", "/test/file.ts")

			expect(result).toBeUndefined()
		})

		it("should handle same symbol name in different files", () => {
			const symbol1 = createMockSymbol("common", "/test/file1.ts")
			const symbol2 = createMockSymbol("common", "/test/file2.ts")

			cache.set("common", "/test/file1.ts", symbol1)
			cache.set("common", "/test/file2.ts", symbol2)

			const result1 = cache.get("common", "/test/file1.ts")
			const result2 = cache.get("common", "/test/file2.ts")

			expect(result1?.filePath).toBe("/test/file1.ts")
			expect(result2?.filePath).toBe("/test/file2.ts")
		})
	})

	describe("invalidateFile", () => {
		it("should remove all symbols from a file", () => {
			cache.set("func1", "/test/file.ts", createMockSymbol("func1", "/test/file.ts"))
			cache.set("func2", "/test/file.ts", createMockSymbol("func2", "/test/file.ts"))
			cache.set("func3", "/other/file.ts", createMockSymbol("func3", "/other/file.ts"))

			cache.invalidateFile("/test/file.ts")

			expect(cache.get("func1", "/test/file.ts")).toBeUndefined()
			expect(cache.get("func2", "/test/file.ts")).toBeUndefined()
			expect(cache.get("func3", "/other/file.ts")).toBeDefined()
		})
	})

	describe("invalidateReferencesTo", () => {
		it("should remove symbols that reference a file", () => {
			const symbol1 = createMockSymbol("ref1", "/test/referenced.ts")
			const symbol2 = createMockSymbol("local", "/test/local.ts")

			cache.set("ref1", "/test/main.ts", symbol1)
			cache.set("local", "/test/local.ts", symbol2)

			cache.invalidateReferencesTo("/test/referenced.ts")

			expect(cache.get("ref1", "/test/main.ts")).toBeUndefined()
			expect(cache.get("local", "/test/local.ts")).toBeDefined()
		})
	})

	describe("clear", () => {
		it("should remove all entries", () => {
			cache.set("func1", "/test/file1.ts", createMockSymbol("func1", "/test/file1.ts"))
			cache.set("func2", "/test/file2.ts", createMockSymbol("func2", "/test/file2.ts"))

			cache.clear()

			expect(cache.get("func1", "/test/file1.ts")).toBeUndefined()
			expect(cache.get("func2", "/test/file2.ts")).toBeUndefined()

			const stats = cache.getStats()
			expect(stats.size).toBe(0)
		})
	})

	describe("getStats", () => {
		it("should return cache statistics", () => {
			cache.set("func1", "/test/file.ts", createMockSymbol("func1", "/test/file.ts"))
			cache.set("func2", "/test/file.ts", createMockSymbol("func2", "/test/file.ts"))

			const stats = cache.getStats()

			expect(stats.size).toBe(2)
			expect(stats.maxSize).toBe(100)
		})
	})

	describe("LRU eviction", () => {
		it("should evict least recently used entries when at capacity", () => {
			const smallCache = new SymbolCache(3, 60000)

			smallCache.set("func1", "/f1.ts", createMockSymbol("func1", "/f1.ts"))
			smallCache.set("func2", "/f2.ts", createMockSymbol("func2", "/f2.ts"))
			smallCache.set("func3", "/f3.ts", createMockSymbol("func3", "/f3.ts"))

			// Access func1 to make it recently used
			smallCache.get("func1", "/f1.ts")

			// Add new entry, should evict func2 (least recently used)
			smallCache.set("func4", "/f4.ts", createMockSymbol("func4", "/f4.ts"))

			expect(smallCache.get("func1", "/f1.ts")).toBeDefined()
			expect(smallCache.get("func4", "/f4.ts")).toBeDefined()

			const stats = smallCache.getStats()
			expect(stats.size).toBe(3)
		})
	})
})
