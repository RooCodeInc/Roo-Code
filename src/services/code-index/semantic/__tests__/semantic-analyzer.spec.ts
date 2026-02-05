/**
 * SemanticAnalyzer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { SemanticAnalyzer } from "../semantic-analyzer"
import { DeepAnalysis, FunctionAnalysis, ClassAnalysis } from "../interfaces"

// Mock the loadEnhancedLanguageParsers function
vi.mock("../../../tree-sitter/languageParser", () => ({
	loadEnhancedLanguageParsers: vi.fn().mockResolvedValue({
		ts: {
			parser: {
				parse: vi.fn((content: string) => ({
					rootNode: createMockAstNode(content),
				})),
			},
			query: {},
			enhancedQuery: {},
		},
		js: {
			parser: {
				parse: vi.fn((content: string) => ({
					rootNode: createMockAstNode(content),
				})),
			},
			query: {},
		},
	}),
}))

// Helper to create mock AST nodes
function createMockAstNode(content: string): any {
	const lines = content.split("\n")

	// Create a minimal mock AST structure
	const mockNode = {
		type: "program",
		text: content,
		childCount: 0,
		startPosition: { row: 0, column: 0 },
		endPosition: { row: lines.length - 1, column: lines[lines.length - 1]?.length || 0 },
		child: vi.fn().mockReturnValue(null),
		childForFieldName: vi.fn().mockReturnValue(null),
		parent: null,
	}

	return mockNode
}

describe("SemanticAnalyzer", () => {
	let analyzer: SemanticAnalyzer

	beforeEach(() => {
		analyzer = new SemanticAnalyzer()
		vi.clearAllMocks()
	})

	describe("getSupportedLanguages", () => {
		it("should return list of supported languages", () => {
			const languages = analyzer.getSupportedLanguages()

			expect(languages).toContain("typescript")
			expect(languages).toContain("javascript")
			expect(languages).toContain("python")
			expect(languages).toContain("java")
			expect(languages.length).toBeGreaterThan(5)
		})
	})

	describe("analyzeDeep", () => {
		it("should analyze TypeScript file", async () => {
			const mockContent = `
export function greet(name: string): string {
	return "Hello, " + name;
}

export class Person {
	constructor(public name: string) {}

	sayHello(): void {
		console.log(greet(this.name));
	}
}
`
			const result = await analyzer.analyzeDeep("/test/file.ts", mockContent)

			expect(result).toBeDefined()
			expect(result.filePath).toBe("/test/file.ts")
			expect(result.language).toBe("typescript")
			expect(result.analyzedAt).toBeInstanceOf(Date)
		})

		it("should throw for unsupported file types", async () => {
			await expect(analyzer.analyzeDeep("/test/file.xyz", "content")).rejects.toThrow("Unsupported file type")
		})

		it("should handle JavaScript files", async () => {
			const mockContent = `
function add(a, b) {
	return a + b;
}
`
			const result = await analyzer.analyzeDeep("/test/file.js", mockContent)

			expect(result.language).toBe("javascript")
		})
	})

	describe("extractSemanticRelations", () => {
		it("should extract relations from code", async () => {
			const code = `
import { helper } from './utils';

function main() {
	helper();
}
`
			const relations = await analyzer.extractSemanticRelations(code, "typescript")

			expect(relations).toBeDefined()
			expect(Array.isArray(relations)).toBe(true)
		})

		it("should return empty array for empty code", async () => {
			const relations = await analyzer.extractSemanticRelations("", "typescript")

			expect(relations).toEqual([])
		})
	})
})

describe("SemanticAnalyzer - Complexity Calculation", () => {
	let analyzer: SemanticAnalyzer

	beforeEach(() => {
		analyzer = new SemanticAnalyzer()
	})

	it("should calculate complexity metrics", async () => {
		const code = `
function complex(x: number): number {
	if (x > 0) {
		if (x > 10) {
			return x * 2;
		}
		return x;
	}
	return 0;
}
`
		const result = await analyzer.analyzeDeep("/test/complex.ts", code)

		expect(result.complexity).toBeDefined()
		expect(result.complexity.linesOfCode).toBeGreaterThan(0)
		expect(result.complexity.cyclomaticComplexity).toBeGreaterThanOrEqual(1)
	})
})
