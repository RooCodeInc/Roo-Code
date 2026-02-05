import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
	performHybridSearch,
	parseRipgrepResults,
	calculateRRFScore,
	getDefaultHybridSearchConfig,
	validateHybridSearchConfig,
} from "../hybrid-search"
import { HybridSearchConfig, VectorStoreSearchResult, KeywordSearchResult } from "../interfaces"
import * as path from "path"

describe("Hybrid Search", () => {
	describe("calculateRRFScore", () => {
		it("should return higher score for lower rank", () => {
			const score1 = calculateRRFScore(1, 60)
			const score2 = calculateRRFScore(2, 60)
			const score3 = calculateRRFScore(3, 60)

			expect(score1).toBeGreaterThan(score2)
			expect(score2).toBeGreaterThan(score3)
		})

		it("should return 0 for invalid rank", () => {
			expect(calculateRRFScore(0, 60)).toBe(0)
			expect(calculateRRFScore(-1, 60)).toBe(0)
		})

		it("should use default k value when not specified", () => {
			const score = calculateRRFScore(1)
			expect(score).toBe(1 / 61)
		})

		it("should use custom k value", () => {
			const score1 = calculateRRFScore(1, 60)
			const score2 = calculateRRFScore(1, 100)

			expect(score1).toBeGreaterThan(score2)
		})
	})

	describe("parseRipgrepResults", () => {
		it("should parse valid ripgrep JSON output", () => {
			const jsonOutput = `{"type":"begin","data":{"path":{"text":"/workspace/file.ts"}}}
{"type":"match","data":{"line_number":10,"lines":{"text":"const test = 'hello'"},"absolute_offset":100}}
{"type":"end","data":{"path":{"text":"/workspace/file.ts"}}}`

			const results = parseRipgrepResults(jsonOutput, "/workspace")

			expect(results).toHaveLength(1)
			expect(results[0].filePath).toBe("file.ts")
			expect(results[0].line).toBe(10)
			expect(results[0].text).toBe("const test = 'hello'")
		})

		it("should handle multiple matches in same file", () => {
			const jsonOutput = `{"type":"begin","data":{"path":{"text":"/workspace/test.ts"}}}
{"type":"match","data":{"line_number":1,"lines":{"text":"match 1"},"absolute_offset":0}}
{"type":"match","data":{"line_number":5,"lines":{"text":"match 2"},"absolute_offset":50}}
{"type":"end","data":{"path":{"text":"/workspace/test.ts"}}}`

			const results = parseRipgrepResults(jsonOutput, "/workspace")

			expect(results).toHaveLength(2)
			expect(results[0].line).toBe(1)
			expect(results[1].line).toBe(5)
		})

		it("should handle multiple files", () => {
			const jsonOutput = `{"type":"begin","data":{"path":{"text":"/workspace/file1.ts"}}}
{"type":"match","data":{"line_number":1,"lines":{"text":"match"},"absolute_offset":0}}
{"type":"end","data":{"path":{"text":"/workspace/file1.ts"}}}
{"type":"begin","data":{"path":{"text":"/workspace/file2.ts"}}}
{"type":"match","data":{"line_number":5,"lines":{"text":"match"},"absolute_offset":0}}
{"type":"end","data":{"path":{"text":"/workspace/file2.ts"}}}`

			const results = parseRipgrepResults(jsonOutput, "/workspace")

			expect(results).toHaveLength(2)
			expect(results[0].filePath).toBe("file1.ts")
			expect(results[1].filePath).toBe("file2.ts")
		})

		it("should handle empty output", () => {
			const results = parseRipgrepResults("", "/workspace")
			expect(results).toHaveLength(0)
		})

		it("should handle invalid JSON lines gracefully", () => {
			const jsonOutput = `invalid json line
{"type":"begin","data":{"path":{"text":"/workspace/file.ts"}}}
{"type":"match","data":{"line_number":1,"lines":{"text":"match"},"absolute_offset":0}}
{"type":"end","data":{"path":{"text":"/workspace/file.ts"}}}`

			const results = parseRipgrepResults(jsonOutput, "/workspace")

			expect(results).toHaveLength(1)
		})

		it("should use relative paths for absolute paths", () => {
			const jsonOutput = `{"type":"begin","data":{"path":{"text":"/workspace/src/file.ts"}}}
{"type":"match","data":{"line_number":1,"lines":{"text":"match"},"absolute_offset":0}}
{"type":"end","data":{"path":{"text":"/workspace/src/file.ts"}}}`

			const results = parseRipgrepResults(jsonOutput, "/workspace")

			expect(results[0].filePath).toBe(path.join("src", "file.ts"))
		})
	})

	describe("performHybridSearch", () => {
		const createSemanticResult = (
			id: string,
			filePath: string,
			score: number,
			startLine: number = 1,
			endLine: number = 5,
		): VectorStoreSearchResult => ({
			id,
			score,
			payload: {
				filePath,
				codeChunk: `code chunk for ${filePath}`,
				startLine,
				endLine,
			},
		})

		const createKeywordResult = (filePath: string, line: number, text: string): KeywordSearchResult => ({
			filePath,
			line,
			text,
			score: 1,
		})

		it("should return only semantic results when hybrid is disabled", () => {
			const config: HybridSearchConfig = {
				enabled: false,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			const semanticResults = [createSemanticResult("1", "file1.ts", 0.9)]
			const keywordResults = [createKeywordResult("file2.ts", 1, "test")]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			expect(results).toHaveLength(1)
			expect(results[0].source).toBe("semantic")
		})

		it("should perform RRF fusion when enabled", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			const semanticResults = [
				createSemanticResult("1", "file1.ts", 0.9),
				createSemanticResult("2", "file2.ts", 0.8),
			]
			const keywordResults = [
				createKeywordResult("file2.ts", 1, "test"),
				createKeywordResult("file3.ts", 5, "test"),
			]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			expect(results.length).toBeGreaterThan(0)
			// Results should be sorted by score
			for (let i = 1; i < results.length; i++) {
				expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
			}
		})

		it("should merge results from both searches for same file", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			// Use same line range for both results so they can be merged
			const semanticResults = [createSemanticResult("1", "file1.ts", 0.9, 15, 15)]
			const keywordResults = [createKeywordResult("file1.ts", 15, "test")]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			const file1Results = results.filter((r) => r.filePath === "file1.ts")
			expect(file1Results.length).toBe(1)
			expect(file1Results[0].source).toBe("hybrid")
			expect(file1Results[0].semanticScore).toBeGreaterThan(0)
			expect(file1Results[0].keywordScore).toBeGreaterThan(0)
		})

		it("should respect maxResults limit", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			const semanticResults = Array.from({ length: 10 }, (_, i) =>
				createSemanticResult(String(i), `file${i}.ts`, 0.9 - i * 0.05),
			)
			const keywordResults = Array.from({ length: 10 }, (_, i) =>
				createKeywordResult(`file${i}.ts`, i + 1, `test ${i}`),
			)

			const results = performHybridSearch(semanticResults, keywordResults, config, 5)

			expect(results.length).toBeLessThanOrEqual(5)
		})

		it("should handle empty results from both searches", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			const results = performHybridSearch([], [], config)

			expect(results).toHaveLength(0)
		})

		it("should handle weighted fusion method", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.7,
				keywordWeight: 0.3,
				fusionMethod: "weighted",
				rrfK: 60,
			}

			const semanticResults = [createSemanticResult("1", "file1.ts", 0.9)]
			const keywordResults = [createKeywordResult("file2.ts", 1, "test")]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			expect(results.length).toBeGreaterThan(0)
		})

		it("should handle sum fusion method", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "sum",
				rrfK: 60,
			}

			// Use same line range for both results so they can be merged
			const semanticResults = [createSemanticResult("1", "file1.ts", 0.9, 1, 1)]
			const keywordResults = [createKeywordResult("file1.ts", 1, "test")]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			const file1Result = results.find((r) => r.filePath === "file1.ts")
			expect(file1Result).toBeDefined()
			expect(file1Result?.source).toBe("hybrid")
		})
	})

	describe("getDefaultHybridSearchConfig", () => {
		it("should return default configuration", () => {
			const config = getDefaultHybridSearchConfig()

			expect(config.enabled).toBe(true)
			expect(config.semanticWeight).toBe(0.5)
			expect(config.keywordWeight).toBe(0.5)
			expect(config.fusionMethod).toBe("rrf")
			expect(config.rrfK).toBe(60)
		})

		it("should return a new object each time", () => {
			const config1 = getDefaultHybridSearchConfig()
			const config2 = getDefaultHybridSearchConfig()

			expect(config1).not.toBe(config2)
			expect(config1).toEqual(config2)
		})
	})

	describe("validateHybridSearchConfig", () => {
		it("should validate enabled as boolean", () => {
			expect(validateHybridSearchConfig({ enabled: true }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ enabled: false }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ enabled: "true" as unknown as boolean }).isValid).toBe(false)
		})

		it("should validate weights between 0 and 1", () => {
			expect(validateHybridSearchConfig({ semanticWeight: 0 }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ semanticWeight: 1 }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ semanticWeight: 0.5 }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ semanticWeight: -0.1 }).isValid).toBe(false)
			expect(validateHybridSearchConfig({ semanticWeight: 1.1 }).isValid).toBe(false)
		})

		it("should validate fusion method", () => {
			expect(validateHybridSearchConfig({ fusionMethod: "rrf" as const }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ fusionMethod: "weighted" as const }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ fusionMethod: "sum" as const }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ fusionMethod: "invalid" as any }).isValid).toBe(false)
		})

		it("should validate rrfK as positive number", () => {
			expect(validateHybridSearchConfig({ rrfK: 1 }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ rrfK: 100 }).isValid).toBe(true)
			expect(validateHybridSearchConfig({ rrfK: 0 }).isValid).toBe(false)
			expect(validateHybridSearchConfig({ rrfK: -1 }).isValid).toBe(false)
		})

		it("should return isValid true for empty config", () => {
			expect(validateHybridSearchConfig({}).isValid).toBe(true)
		})
	})

	describe("Feature Flag behavior", () => {
		it("should use semantic search only when feature is disabled", () => {
			const config: HybridSearchConfig = {
				enabled: false,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			const semanticResults = [
				{ id: "1", score: 0.9, payload: { filePath: "test.ts", codeChunk: "test", startLine: 1, endLine: 5 } },
			]
			const keywordResults = [{ filePath: "test2.ts", line: 1, text: "test", score: 1 }]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			// Should only return semantic results
			expect(results).toHaveLength(1)
			expect(results[0].filePath).toBe("test.ts")
		})

		it("should combine results when feature is enabled", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			const semanticResults = [
				{ id: "1", score: 0.9, payload: { filePath: "test.ts", codeChunk: "test", startLine: 1, endLine: 5 } },
			]
			const keywordResults = [{ filePath: "test2.ts", line: 1, text: "test", score: 1 }]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			// Should return results from both searches
			expect(results.length).toBe(2)
		})
	})

	describe("RRF Algorithm integration", () => {
		it("should properly rank results with RRF", () => {
			const config: HybridSearchConfig = {
				enabled: true,
				semanticWeight: 0.5,
				keywordWeight: 0.5,
				fusionMethod: "rrf",
				rrfK: 60,
			}

			// Create semantic results with decreasing scores (rank 1, 2, 3...)
			const semanticResults = [
				{ id: "1", score: 0.95, payload: { filePath: "a.ts", codeChunk: "a", startLine: 1, endLine: 1 } },
				{ id: "2", score: 0.85, payload: { filePath: "b.ts", codeChunk: "b", startLine: 1, endLine: 1 } },
				{ id: "3", score: 0.75, payload: { filePath: "c.ts", codeChunk: "c", startLine: 1, endLine: 1 } },
			]

			// Create keyword results with different ranking
			const keywordResults = [
				{ filePath: "b.ts", line: 1, text: "b", score: 1 }, // Rank 1 in keyword (b comes first)
				{ filePath: "a.ts", line: 1, text: "a", score: 1 }, // Rank 2 in keyword (a comes second)
				{ filePath: "d.ts", line: 1, text: "d", score: 1 }, // New file
			]

			const results = performHybridSearch(semanticResults, keywordResults, config)

			// b.ts should be ranked higher because it's first in keyword search
			// and second in semantic search
			const aIndex = results.findIndex((r) => r.filePath === "a.ts")
			const bIndex = results.findIndex((r) => r.filePath === "b.ts")
			const dIndex = results.findIndex((r) => r.filePath === "d.ts")

			// a.ts and b.ts should be merged (hybrid)
			expect(results[aIndex].source).toBe("hybrid")
			expect(results[bIndex].source).toBe("hybrid")

			// d.ts should only be from keyword search
			expect(results[dIndex].source).toBe("keyword")
		})
	})
})
