import * as path from "path"
import { createHash } from "crypto"
import { VectorStoreSearchResult, HybridSearchConfig, DEFAULT_HYBRID_SEARCH_CONFIG } from "./interfaces"
import { IEmbedder } from "./interfaces/embedder"
import { IVectorStore } from "./interfaces/vector-store"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { regexSearchFiles } from "../ripgrep"
import { performHybridSearch, parseRipgrepResults, validateHybridSearchConfig } from "./hybrid-search"
import NodeCache from "node-cache"
import * as vscode from "vscode"

/**
 * Interface for search result cache entry
 */
interface SearchResultCacheEntry {
	results: VectorStoreSearchResult[]
	timestamp: number
	query: string
	directoryPrefix?: string
}

/**
 * Interface for embedding cache entry
 */
interface EmbeddingCacheEntry {
	embedding: number[]
	textHash: string
}

/**
 * Service responsible for searching the code index.
 */
export class CodeIndexSearchService {
	/**
	 * Hybrid search configuration
	 */
	private hybridConfig: HybridSearchConfig = { ...DEFAULT_HYBRID_SEARCH_CONFIG }

	/**
	 * LRU cache for search results (max 100 entries, TTL 10 minutes)
	 */
	private searchResultCache: NodeCache = new NodeCache({
		stdTTL: 600, // 10 minutes
	})

	/**
	 * Track the number of items in search result cache for accurate stats
	 */
	private searchCacheSizeTracker = 0

	/**
	 * Cache for embeddings to avoid recalculating same text embeddings
	 */
	private embeddingCache: Map<string, EmbeddingCacheEntry> = new Map()

	/**
	 * Statistics for monitoring cache performance
	 */
	private searchCacheHits = 0
	private searchCacheMisses = 0
	private embeddingCacheHits = 0
	private embeddingCacheMisses = 0

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
	) {}

	/**
	 * Generates a cache key for search queries
	 */
	private generateSearchCacheKey(query: string, directoryPrefix?: string): string {
		const keyParts = [query]
		if (directoryPrefix) {
			keyParts.push(directoryPrefix)
		}
		return createHash("sha256").update(keyParts.join("|")).digest("hex")
	}

	/**
	 * Generates a hash for text to use as embedding cache key
	 */
	private generateTextHash(text: string): string {
		return createHash("sha256").update(text).digest("hex")
	}

	/**
	 * Gets embedding from cache or creates new one
	 */
	private async getOrCreateEmbedding(text: string): Promise<number[]> {
		const textHash = this.generateTextHash(text)
		const cached = this.embeddingCache.get(textHash)

		if (cached) {
			this.embeddingCacheHits++
			console.log("[CodeIndexSearchService] Embedding cache hit for query")
			return cached.embedding
		}

		this.embeddingCacheMisses++
		console.log("[CodeIndexSearchService] Embedding cache miss for query")

		const embeddingResponse = await this.embedder.createEmbeddings([text])
		const embedding = embeddingResponse?.embeddings[0]

		if (embedding) {
			this.embeddingCache.set(textHash, {
				embedding,
				textHash,
			})
		}

		return embedding
	}

	/**
	 * Sets the hybrid search configuration
	 * @param config Partial hybrid search configuration
	 */
	public setHybridSearchConfig(config: Partial<HybridSearchConfig>): void {
		const validation = validateHybridSearchConfig(config)
		if (!validation.isValid) {
			console.warn("[CodeIndexSearchService] Invalid hybrid search config:", validation.error)
			return
		}
		this.hybridConfig = { ...this.hybridConfig, ...config }
		console.log("[CodeIndexSearchService] Hybrid search config updated:", this.hybridConfig)
	}

	/**
	 * Gets the current hybrid search configuration
	 * @returns Current HybridSearchConfig
	 */
	public getHybridSearchConfig(): HybridSearchConfig {
		return { ...this.hybridConfig }
	}

	/**
	 * Gets cache statistics for monitoring
	 * @returns Object containing cache statistics
	 */
	public getCacheStats(): {
		searchCacheSize: number
		embeddingCacheSize: number
		searchCacheHits: number
		searchCacheMisses: number
		embeddingCacheHits: number
		embeddingCacheMisses: number
		searchCacheHitRate: number
		embeddingCacheHitRate: number
	} {
		const searchTotal = this.searchCacheHits + this.searchCacheMisses
		const embeddingTotal = this.embeddingCacheHits + this.embeddingCacheMisses

		return {
			searchCacheSize: this.searchCacheSizeTracker,
			embeddingCacheSize: this.embeddingCache.size,
			searchCacheHits: this.searchCacheHits,
			searchCacheMisses: this.searchCacheMisses,
			embeddingCacheHits: this.embeddingCacheHits,
			embeddingCacheMisses: this.embeddingCacheMisses,
			searchCacheHitRate: searchTotal > 0 ? Math.round((this.searchCacheHits / searchTotal) * 10000) / 100 : 0,
			embeddingCacheHitRate:
				embeddingTotal > 0 ? Math.round((this.embeddingCacheHits / embeddingTotal) * 10000) / 100 : 0,
		}
	}

	/**
	 * Clears all caches
	 */
	public clearCaches(): void {
		this.searchResultCache.flushAll()
		this.embeddingCache.clear()
		this.searchCacheSizeTracker = 0
		// Reset stats
		this.searchCacheHits = 0
		this.searchCacheMisses = 0
		this.embeddingCacheHits = 0
		this.embeddingCacheMisses = 0
		console.log("[CodeIndexSearchService] All caches cleared")
	}

	/**
	 * Searches the code index for relevant content using hybrid search.
	 * Combines semantic search with keyword search for improved results.
	 * @param query The search query
	 * @param directoryPrefix Optional directory path to filter results by
	 * @param workspacePath Optional workspace path for keyword search
	 * @returns Array of hybrid search results
	 * @throws Error if the service is not properly configured or ready
	 */
	public async searchIndex(
		query: string,
		directoryPrefix?: string,
		workspacePath?: string,
	): Promise<VectorStoreSearchResult[]> {
		if (!this.configManager.isFeatureEnabled || !this.configManager.isFeatureConfigured) {
			throw new Error("Code index feature is disabled or not configured.")
		}

		const minScore = this.configManager.currentSearchMinScore
		const maxResults = this.configManager.currentSearchMaxResults

		const currentState = this.stateManager.getCurrentStatus().systemStatus
		if (currentState !== "Indexed" && currentState !== "Indexing") {
			// Allow search during Indexing too
			throw new Error(`Code index is not ready for search. Current state: ${currentState}`)
		}

		// Check search result cache first
		const cacheKey = this.generateSearchCacheKey(query, directoryPrefix)
		const cachedResult = this.searchResultCache.get<SearchResultCacheEntry>(cacheKey)

		if (cachedResult) {
			this.searchCacheHits++
			console.log("[CodeIndexSearchService] Search cache hit for query:", query)
			return cachedResult.results
		}

		this.searchCacheMisses++
		console.log("[CodeIndexSearchService] Search cache miss for query:", query)

		try {
			// Get embedding from cache or create new one
			const vector = await this.getOrCreateEmbedding(query)
			if (!vector) {
				throw new Error("Failed to generate embedding for query.")
			}

			// Handle directory prefix
			let normalizedPrefix: string | undefined = undefined
			if (directoryPrefix) {
				normalizedPrefix = path.normalize(directoryPrefix)
			}

			// Perform semantic search
			const semanticResults = await this.vectorStore.search(vector, normalizedPrefix, minScore, maxResults)

			// If hybrid search is disabled, return semantic results only
			if (!this.hybridConfig.enabled || !workspacePath) {
				// Cache semantic-only results
				this.searchResultCache.set(cacheKey, {
					results: semanticResults,
					timestamp: Date.now(),
					query,
					directoryPrefix,
				})
				this.searchCacheSizeTracker++
				return semanticResults
			}

			// Perform keyword search using ripgrep
			const searchDirectory = directoryPrefix
				? path.isAbsolute(directoryPrefix)
					? directoryPrefix
					: path.join(workspacePath, directoryPrefix)
				: workspacePath

			let keywordResults = []
			try {
				const ripgrepOutput = await regexSearchFiles(workspacePath, searchDirectory, query)
				keywordResults = parseRipgrepResults(ripgrepOutput, workspacePath)
			} catch (ripgrepError) {
				console.warn(
					"[CodeIndexSearchService] Keyword search failed, falling back to semantic only:",
					ripgrepError,
				)
				// Cache semantic-only results
				this.searchResultCache.set(cacheKey, {
					results: semanticResults,
					timestamp: Date.now(),
					query,
					directoryPrefix,
				})
				this.searchCacheSizeTracker++
				return semanticResults
			}

			// Perform hybrid search fusion
			const hybridResults = performHybridSearch(semanticResults, keywordResults, this.hybridConfig, maxResults)

			// Convert hybrid results back to VectorStoreSearchResult format
			const formattedResults = hybridResults.map((result) => ({
				id: `${result.filePath}:${result.startLine}`,
				score: result.score,
				payload: {
					filePath: result.filePath,
					codeChunk: result.codeChunk,
					startLine: result.startLine,
					endLine: result.endLine,
					source: result.source,
					semanticScore: result.semanticScore,
					keywordScore: result.keywordScore,
				},
			}))

			// Cache the hybrid results
			this.searchResultCache.set(cacheKey, {
				results: formattedResults,
				timestamp: Date.now(),
				query,
				directoryPrefix,
			})
			this.searchCacheSizeTracker++

			return formattedResults
		} catch (error) {
			console.error("[CodeIndexSearchService] Error during search:", error)
			this.stateManager.setSystemState("Error", `Search failed: ${(error as Error).message}`)

			// Capture telemetry for the error
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: (error as Error).message,
				stack: (error as Error).stack,
				location: "searchIndex",
			})

			throw error // Re-throw the error after setting state
		}
	}
}
