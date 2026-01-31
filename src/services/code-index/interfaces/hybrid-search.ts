/**
 * Configuration interface for Hybrid Search feature
 * Combines semantic search with keyword search for improved results
 */
export interface HybridSearchConfig {
	/**
	 * Enable or disable hybrid search feature
	 */
	enabled: boolean

	/**
	 * Weight for semantic search results (0.0 - 1.0)
	 * Higher values give more importance to semantic similarity
	 */
	semanticWeight: number

	/**
	 * Weight for keyword search results (0.0 - 1.0)
	 * Higher values give more importance to exact keyword matches
	 */
	keywordWeight: number

	/**
	 * Method to use for fusing results from both searches
	 * - 'rrf': Reciprocal Rank Fusion
	 * - 'weighted': Weighted combination of scores
	 * - 'sum': Simple sum of normalized scores
	 */
	fusionMethod: "rrf" | "weighted" | "sum"

	/**
	 * Constant used in RRF algorithm for ranking
	 * Higher values reduce the impact of rank position
	 */
	rrfK: number
}

/**
 * Result from keyword search (ripgrep)
 */
export interface KeywordSearchResult {
	/**
	 * Relative file path
	 */
	filePath: string

	/**
	 * Line number of the match
	 */
	line: number

	/**
	 * The matched text
	 */
	text: string

	/**
	 * Column position of the match
	 */
	column?: number

	/**
	 * Match score (higher = more relevant)
	 */
	score: number
}

/**
 * Hybrid search result combining semantic and keyword matches
 */
export interface HybridSearchResult {
	/**
	 * Relative file path
	 */
	filePath: string

	/**
	 * Code chunk content
	 */
	codeChunk: string

	/**
	 * Starting line number
	 */
	startLine: number

	/**
	 * Ending line number
	 */
	endLine: number

	/**
	 * Combined score from both searches
	 */
	score: number

	/**
	 * Semantic search score component
	 */
	semanticScore: number

	/**
	 * Keyword search score component
	 */
	keywordScore: number

	/**
	 * Source of the match (semantic, keyword, or both)
	 */
	source: "semantic" | "keyword" | "hybrid"
}

/**
 * Default configuration for hybrid search
 */
export const DEFAULT_HYBRID_SEARCH_CONFIG: HybridSearchConfig = {
	enabled: true,
	semanticWeight: 0.5,
	keywordWeight: 0.5,
	fusionMethod: "rrf",
	rrfK: 60,
}
