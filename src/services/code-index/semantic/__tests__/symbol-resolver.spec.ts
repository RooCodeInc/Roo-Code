/**
 * SymbolResolver Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { SymbolResolver } from "../symbol-resolver"
import { SemanticAnalyzer } from "../semantic-analyzer"
import { FileContext, ResolvedSymbol } from "../interfaces"

// Mock the SemanticAnalyzer
vi.mock("../semantic-analyzer", () => ({
	SemanticAnalyzer: vi.fn().mockImplementation(() => ({
		analyzeDeep: vi.fn().mockResolvedValue({
			symbols: [
				{
					name: "testFunction",
					type: "function",
					scope: "module",
					position: { line: 1, column: 0 },
					references: [],
				},
				{
					name: "TestClass",
					type: "class",
					scope: "module",
					position: { line: 5, column: 0 },
					references: [],
				},
			],
			imports: [],
			exports: [{ name: "testFunction", type: "function", isDefault: false, isReExport: false }],
		}),
	})),
}))

describe("SymbolResolver", () => {
	let resolver: SymbolResolver

	beforeEach(() => {
		resolver = new SymbolResolver()
		vi.clearAllMocks()
	})

	afterEach(() => {
		resolver.clear()
	})

	describe("indexFile", () => {
		it("should index symbols from a file", async () => {
			const content = `
export function testFunction() {}
export class TestClass {}
`
			await resolver.indexFile("/test/file.ts", content)

			const stats = resolver.getStats()
			expect(stats.totalFiles).toBe(1)
			expect(stats.totalSymbols).toBeGreaterThan(0)
		})

		it("should handle multiple files", async () => {
			await resolver.indexFile("/test/file1.ts", "export function func1() {}")
			await resolver.indexFile("/test/file2.ts", "export function func2() {}")

			const stats = resolver.getStats()
			expect(stats.totalFiles).toBe(2)
		})
	})

	describe("resolveSymbol", () => {
		beforeEach(async () => {
			await resolver.indexFile("/test/utils.ts", "export function helper() {}")
		})

		it("should resolve local symbols", async () => {
			const context: FileContext = {
				filePath: "/test/main.ts",
				language: "typescript",
				imports: [],
				localSymbols: [
					{
						name: "localVar",
						type: "variable",
						scope: "local",
						position: { line: 1, column: 0 },
						references: [],
					},
				],
			}

			const resolved = await resolver.resolveSymbol("localVar", context)

			expect(resolved).toBeDefined()
			expect(resolved?.name).toBe("localVar")
		})

		it("should return null for unknown symbols", async () => {
			const context: FileContext = {
				filePath: "/test/main.ts",
				language: "typescript",
				imports: [],
				localSymbols: [],
			}

			const resolved = await resolver.resolveSymbol("unknownSymbol", context)

			expect(resolved).toBeNull()
		})

		it("should use cache on second lookup", async () => {
			const context: FileContext = {
				filePath: "/test/main.ts",
				language: "typescript",
				imports: [],
				localSymbols: [
					{
						name: "cachedSymbol",
						type: "variable",
						scope: "local",
						position: { line: 1, column: 0 },
						references: [],
					},
				],
			}

			// First lookup
			const first = await resolver.resolveSymbol("cachedSymbol", context)

			// Second lookup should use cache
			const second = await resolver.resolveSymbol("cachedSymbol", context)

			expect(first).toBeDefined()
			expect(second).toBeDefined()
			expect(first?.name).toBe(second?.name)
		})
	})

	describe("invalidateFile", () => {
		it("should remove file from index", async () => {
			await resolver.indexFile("/test/file.ts", "export function test() {}")

			let stats = resolver.getStats()
			expect(stats.totalFiles).toBe(1)

			resolver.invalidateFile("/test/file.ts")

			stats = resolver.getStats()
			expect(stats.totalFiles).toBe(0)
		})
	})

	describe("getReferences", () => {
		it("should return references to a symbol", async () => {
			await resolver.indexFile("/test/file.ts", "export function test() {}")

			const refs = await resolver.getReferences("test", "/test/file.ts")

			expect(refs).toBeDefined()
			expect(Array.isArray(refs)).toBe(true)
		})
	})
})
