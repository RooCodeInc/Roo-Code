import * as path from "path"
import { VectorStoreSearchResult } from "./interfaces"
import {
	HybridSearchConfig,
	HybridSearchResult,
	KeywordSearchResult,
	DEFAULT_HYBRID_SEARCH_CONFIG,
} from "./interfaces/hybrid-search"

/**
 * Generates a unique key for a result based on file path and line range
 * @param filePath - The file path
 * @param startLine - Starting line number
 * @param endLine - Ending line number
 * @returns A unique string key
 */
function generateResultKey(filePath: string, startLine: number, endLine: number): string {
	return `${filePath}:${startLine}-${endLine}`
}

/**
 * Normalizes a score to a 0-1 range using min-max normalization
 * @param scores Array of scores to normalize
 * @param value The value to normalize
 * @returns Normalized score between 0 and 1
 */
function normalizeScore(scores: number[], value: number): number {
	const min = Math.min(...scores)
	const max = Math.max(...scores)
	if (max === min) {
		return 1
	}
	return (value - min) / (max - min)
}

/**
 * Calculates Reciprocal Rank Fusion (RRF) score for a result
 * RRF combines multiple ranked lists by considering the reciprocal of each rank
 * @param rank The rank position of the result (1-indexed)
 * @param k Constant to reduce impact of rank (default: 60)
 * @returns RRF score
 */
export function calculateRRFScore(rank: number, k: number = DEFAULT_HYBRID_SEARCH_CONFIG.rrfK): number {
	if (rank <= 0) {
		return 0
	}
	return 1 / (rank + k)
}

/**
 * Parses ripgrep JSON output into KeywordSearchResult objects
 * @param jsonOutput Raw JSON output from ripgrep
 * @param cwd Current working directory for relative path calculation
 * @returns Array of KeywordSearchResult objects
 */
export function parseRipgrepResults(jsonOutput: string, cwd: string): KeywordSearchResult[] {
	const results: KeywordSearchResult[] = []

	try {
		const lines = jsonOutput.trim().split("\n")
		let currentFile: string | null = null

		for (const line of lines) {
			if (!line.trim()) continue

			try {
				const parsed = JSON.parse(line)

				if (parsed.type === "begin" && parsed.data?.path?.text) {
					currentFile = parsed.data.path.text
				} else if (parsed.type === "match" && currentFile) {
					const lineNum = parsed.data?.line_number || 0
					const text = parsed.data?.lines?.text || ""
					const column = parsed.data?.absolute_offset

					// Create a unique key for this match
					const filePath = path.isAbsolute(currentFile) ? path.relative(cwd, currentFile) : currentFile

					results.push({
						filePath,
						line: lineNum,
						text,
						column,
						score: 1, // Default score for keyword matches
					})
				}
			} catch {
				// Skip invalid JSON lines
			}
		}
	} catch (error) {
		console.error("[HybridSearch] Error parsing ripgrep results:", error)
	}

	return results
}

/**
 * Converts VectorStoreSearchResult to HybridSearchResult format
 * @param result The vector store search result
 * @param score The semantic search score
 * @returns HybridSearchResult object
 */
function toHybridResult(result: VectorStoreSearchResult, score: number): HybridSearchResult {
	return {
		filePath: result.payload?.filePath || "",
		codeChunk: result.payload?.codeChunk || "",
		startLine: result.payload?.startLine || 0,
		endLine: result.payload?.endLine || 0,
		score: score,
		semanticScore: score,
		keywordScore: 0,
		source: "semantic",
	}
}

/**
 * Converts KeywordSearchResult to HybridSearchResult format
 * @param result The keyword search result
 * @param score The keyword match score
 * @returns HybridSearchResult object
 */
function toKeywordHybridResult(result: KeywordSearchResult, score: number): HybridSearchResult {
	return {
		filePath: result.filePath,
		codeChunk: result.text,
		startLine: result.line,
		endLine: result.line,
		score: score,
		semanticScore: 0,
		keywordScore: score,
		source: "keyword",
	}
}

/**
 * Fuses two ranked lists of results using Reciprocal Rank Fusion
 * @param semanticResults Results from semantic search with their ranks
 * @param keywordResults Results from keyword search with their ranks
 * @param config Hybrid search configuration
 * @returns Fused and ranked results
 */
function fuseResultsWithRRF(
	semanticResults: Array<{ result: HybridSearchResult; rank: number }>,
	keywordResults: Array<{ result: HybridSearchResult; rank: number }>,
	config: HybridSearchConfig,
): HybridSearchResult[] {
	const scoreMap = new Map<string, { semantic: number; keyword: number; total: number }>()

	// Calculate RRF scores for semantic results
	for (const { result, rank } of semanticResults) {
		const key = generateResultKey(result.filePath, result.startLine, result.endLine)
		const rrfScore = calculateRRFScore(rank, config.rrfK)
		scoreMap.set(key, {
			semantic: rrfScore,
			keyword: 0,
			total: rrfScore * config.semanticWeight,
		})
		// Update result with semantic score
		result.semanticScore = rrfScore
	}

	// Calculate RRF scores for keyword results
	for (const { result, rank } of keywordResults) {
		const key = generateResultKey(result.filePath, result.startLine, result.endLine)
		const rrfScore = calculateRRFScore(rank, config.rrfK)
		const existing = scoreMap.get(key)

		if (existing) {
			existing.keyword = rrfScore
			existing.total = existing.semantic * config.semanticWeight + rrfScore * config.keywordWeight
			result.source = "hybrid"
			result.semanticScore = existing.semantic
			result.keywordScore = rrfScore
			result.score = existing.total
		} else {
			scoreMap.set(key, {
				semantic: 0,
				keyword: rrfScore,
				total: rrfScore * config.keywordWeight,
			})
			result.keywordScore = rrfScore
		}
	}

	// Combine all results and sort by total score
	const allResults = [...semanticResults.map((r) => r.result), ...keywordResults.map((r) => r.result)]
	const uniqueResults = new Map<string, HybridSearchResult>()

	for (const result of allResults) {
		const key = generateResultKey(result.filePath, result.startLine, result.endLine)
		const scores = scoreMap.get(key)
		if (scores) {
			result.score = scores.total
			uniqueResults.set(key, result)
		}
	}

	return Array.from(uniqueResults.values()).sort((a, b) => b.score - a.score)
}

/**
 * Fuses results using weighted combination of normalized scores
 * @param semanticResults Results from semantic search
 * @param keywordResults Results from keyword search
 * @param config Hybrid search configuration
 * @returns Fused and ranked results
 */
function fuseResultsWithWeighted(
	semanticResults: HybridSearchResult[],
	keywordResults: HybridSearchResult[],
	config: HybridSearchConfig,
): HybridSearchResult[] {
	// Collect all scores for normalization
	const allSemanticScores = semanticResults.map((r) => r.semanticScore)
	const allKeywordScores = keywordResults.map((r) => r.keywordScore)

	// Create a map to track which results have been merged
	const resultMap = new Map<string, HybridSearchResult>()

	// Process semantic results
	for (const result of semanticResults) {
		const key = generateResultKey(result.filePath, result.startLine, result.endLine)
		const normalizedScore =
			allSemanticScores.length > 1 ? normalizeScore(allSemanticScores, result.semanticScore) : 1
		result.semanticScore = normalizedScore
		result.score = normalizedScore * config.semanticWeight
		resultMap.set(key, result)
	}

	// Process keyword results
	for (const result of keywordResults) {
		const key = generateResultKey(result.filePath, result.startLine, result.endLine)
		const normalizedScore = allKeywordScores.length > 1 ? normalizeScore(allKeywordScores, result.keywordScore) : 1
		result.keywordScore = normalizedScore

		const existing = resultMap.get(key)
		if (existing) {
			// Merge with existing result
			existing.keywordScore = normalizedScore
			existing.score = existing.semanticScore * config.semanticWeight + normalizedScore * config.keywordWeight
			existing.source = "hybrid"
		} else {
			result.score = normalizedScore * config.keywordWeight
			resultMap.set(key, result)
		}
	}

	return Array.from(resultMap.values()).sort((a, b) => b.score - a.score)
}

/**
 * Fuses results using simple sum of normalized scores
 * @param semanticResults Results from semantic search
 * @param keywordResults Results from keyword search
 * @param config Hybrid search configuration
 * @returns Fused and ranked results
 */
function fuseResultsWithSum(
	semanticResults: HybridSearchResult[],
	keywordResults: HybridSearchResult[],
	config: HybridSearchConfig,
): HybridSearchResult[] {
	return fuseResultsWithWeighted(semanticResults, keywordResults, config)
}

/**
 * Performs hybrid search combining semantic and keyword search results
 * @param semanticResults Results from vector store (semantic search)
 * @param keywordResults Results from ripgrep (keyword search)
 * @param config Hybrid search configuration
 * @param maxResults Maximum number of results to return
 * @returns Combined and ranked results
 */
export function performHybridSearch(
	semanticResults: VectorStoreSearchResult[],
	keywordResults: KeywordSearchResult[],
	config: HybridSearchConfig = DEFAULT_HYBRID_SEARCH_CONFIG,
	maxResults: number = 50,
): HybridSearchResult[] {
	// If hybrid search is disabled, return only semantic results
	if (!config.enabled) {
		return semanticResults.map((r) => toHybridResult(r, r.score))
	}

	// Convert semantic results to hybrid format
	const hybridSemanticResults = semanticResults.map((r, index) => ({
		result: toHybridResult(r, r.score),
		rank: index + 1,
	}))

	// Convert keyword results to hybrid format
	const hybridKeywordResults = keywordResults.map((r, index) => ({
		result: toKeywordHybridResult(r, r.score),
		rank: index + 1,
	}))

	// Fuse results based on the configured method
	let fusedResults: HybridSearchResult[]

	switch (config.fusionMethod) {
		case "rrf":
			fusedResults = fuseResultsWithRRF(hybridSemanticResults, hybridKeywordResults, config)
			break
		case "weighted":
			fusedResults = fuseResultsWithWeighted(
				hybridSemanticResults.map((r) => r.result),
				hybridKeywordResults.map((r) => r.result),
				config,
			)
			break
		case "sum":
		default:
			fusedResults = fuseResultsWithSum(
				hybridSemanticResults.map((r) => r.result),
				hybridKeywordResults.map((r) => r.result),
				config,
			)
			break
	}

	return fusedResults.slice(0, maxResults)
}

/**
 * Creates a default hybrid search configuration
 * @returns Default HybridSearchConfig object
 */
export function getDefaultHybridSearchConfig(): HybridSearchConfig {
	return { ...DEFAULT_HYBRID_SEARCH_CONFIG }
}

/**
 * Validates hybrid search configuration
 * @param config Configuration to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateHybridSearchConfig(config: Partial<HybridSearchConfig>): { isValid: boolean; error?: string } {
	if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
		return { isValid: false, error: "enabled must be a boolean" }
	}

	if (config.semanticWeight !== undefined) {
		if (typeof config.semanticWeight !== "number" || config.semanticWeight < 0 || config.semanticWeight > 1) {
			return { isValid: false, error: "semanticWeight must be a number between 0 and 1" }
		}
	}

	if (config.keywordWeight !== undefined) {
		if (typeof config.keywordWeight !== "number" || config.keywordWeight < 0 || config.keywordWeight > 1) {
			return { isValid: false, error: "keywordWeight must be a number between 0 and 1" }
		}
	}

	if (config.fusionMethod !== undefined) {
		const validMethods = ["rrf", "weighted", "sum"]
		if (!validMethods.includes(config.fusionMethod)) {
			return {
				isValid: false,
				error: `fusionMethod must be one of: ${validMethods.join(", ")}`,
			}
		}
	}

	if (config.rrfK !== undefined) {
		if (typeof config.rrfK !== "number" || config.rrfK <= 0) {
			return { isValid: false, error: "rrfK must be a positive number" }
		}
	}

	return { isValid: true }
}
