import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest"
import { CodeIndexSearchService } from "../search-service"
import { CodeIndexConfigManager } from "../config-manager"
import { CodeIndexStateManager } from "../state-manager"
import { IEmbedder } from "../interfaces/embedder"
import { IVectorStore } from "../interfaces/vector-store"
import { VectorStoreSearchResult } from "../interfaces"

// Mock dependencies
const mockConfigManager = {
	isFeatureEnabled: true,
	isFeatureConfigured: true,
	currentSearchMinScore: 0.5,
	currentSearchMaxResults: 10,
} as unknown as CodeIndexConfigManager

const mockStateManager = {
	getCurrentStatus: vi.fn().mockReturnValue({ systemStatus: "Indexed" }),
	setSystemState: vi.fn(),
} as unknown as CodeIndexStateManager

const mockEmbedder = {
	createEmbeddings: vi.fn(),
} as unknown as IEmbedder

const mockVectorStore = {
	search: vi.fn(),
} as unknown as IVectorStore

describe("CodeIndexSearchService", () => {
	let searchService: CodeIndexSearchService

	beforeEach(() => {
		vi.clearAllMocks()
		searchService = new CodeIndexSearchService(mockConfigManager, mockStateManager, mockEmbedder, mockVectorStore)
	})

	afterEach(() => {
		searchService.clearCaches()
	})

	describe("Search Result Cache", () => {
		it("should return cached results on cache hit", async () => {
			const query = "test query"
			const cachedResults: VectorStoreSearchResult[] = [
				{
					id: "file1.ts:1",
					score: 0.9,
					payload: {
						filePath: "file1.ts",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
						source: "semantic",
						semanticScore: 0.9,
						keywordScore: 0,
					},
				},
			]

			// Mock embedding and search
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce(cachedResults)

			// First call - cache miss
			const results1 = await searchService.searchIndex(query)
			expect(results1).toEqual(cachedResults)
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalledTimes(1)
			expect(mockVectorStore.search).toHaveBeenCalledTimes(1)

			// Second call - cache hit
			const results2 = await searchService.searchIndex(query)
			expect(results2).toEqual(cachedResults)
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalledTimes(1) // Should not be called again
			expect(mockVectorStore.search).toHaveBeenCalledTimes(1) // Should not be called again

			// Verify cache stats
			const stats = searchService.getCacheStats()
			expect(stats.searchCacheHits).toBe(1)
			expect(stats.searchCacheMisses).toBe(1)
		})

		it("should return different results for different queries", async () => {
			const query1 = "test query 1"
			const query2 = "test query 2"

			const results1: VectorStoreSearchResult[] = [
				{
					id: "file1.ts:1",
					score: 0.9,
					payload: {
						filePath: "file1.ts",
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
						source: "semantic",
						semanticScore: 0.9,
						keywordScore: 0,
					},
				},
			]

			const results2: VectorStoreSearchResult[] = [
				{
					id: "file2.ts:1",
					score: 0.8,
					payload: {
						filePath: "file2.ts",
						codeChunk: "test code 2",
						startLine: 1,
						endLine: 5,
						source: "semantic",
						semanticScore: 0.8,
						keywordScore: 0,
					},
				},
			]

			// Mock for first query
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce(results1)

			// First call
			const firstResults = await searchService.searchIndex(query1)
			expect(firstResults).toEqual(results1)

			// Mock for second query
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.4, 0.5, 0.6]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce(results2)

			// Second call with different query
			const secondResults = await searchService.searchIndex(query2)
			expect(secondResults).toEqual(results2)

			// Both should be cached separately
			const stats = searchService.getCacheStats()
			expect(stats.searchCacheMisses).toBe(2)
			expect(stats.searchCacheSize).toBe(2)
		})

		it("should include directoryPrefix in cache key", async () => {
			const query = "test query"
			const prefix1 = "src/components"
			const prefix2 = "src/utils"

			const results1: VectorStoreSearchResult[] = [
				{
					id: "file1.ts:1",
					score: 0.9,
					payload: {
						filePath: "file1.ts",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
						source: "semantic",
						semanticScore: 0.9,
						keywordScore: 0,
					},
				},
			]

			const results2: VectorStoreSearchResult[] = [
				{
					id: "file2.ts:1",
					score: 0.8,
					payload: {
						filePath: "file2.ts",
						codeChunk: "test code 2",
						startLine: 1,
						endLine: 5,
						source: "semantic",
						semanticScore: 0.8,
						keywordScore: 0,
					},
				},
			]

			// First call with prefix1
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce(results1)
			await searchService.searchIndex(query, prefix1)

			// Second call with same query but different prefix
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.4, 0.5, 0.6]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce(results2)
			await searchService.searchIndex(query, prefix2)

			// Both should be cache misses (different cache keys)
			const stats = searchService.getCacheStats()
			expect(stats.searchCacheMisses).toBe(2)
		})
	})

	describe("Embedding Cache", () => {
		it("should track embedding cache statistics", async () => {
			const query = "test query"

			// First call - should create embedding
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce([])
			await searchService.searchIndex(query)

			const stats = searchService.getCacheStats()
			expect(stats.embeddingCacheMisses).toBe(1)
			expect(stats.embeddingCacheSize).toBe(1)
		})

		it("should handle different texts with different embeddings", async () => {
			const query1 = "test query 1"
			const query2 = "different query"

			// First query
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce([])
			await searchService.searchIndex(query1)

			// Second query - different text, should create new embedding
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.4, 0.5, 0.6]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce([])
			await searchService.searchIndex(query2)

			expect(mockEmbedder.createEmbeddings).toHaveBeenCalledTimes(2)

			const stats = searchService.getCacheStats()
			expect(stats.embeddingCacheMisses).toBe(2)
			expect(stats.embeddingCacheSize).toBe(2)
		})
	})

	describe("Cache Statistics", () => {
		it("should report correct cache sizes", async () => {
			searchService.clearCaches()

			// Add some cached entries
			for (let i = 0; i < 3; i++) {
				const query = `query ${i}`
				;(mockEmbedder.createEmbeddings as Mock).mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] })
				;(mockVectorStore.search as Mock).mockResolvedValue([])
				await searchService.searchIndex(query)
			}

			const stats = searchService.getCacheStats()
			expect(stats.searchCacheSize).toBe(3)
			expect(stats.embeddingCacheSize).toBe(3)
		})

		it("should calculate hit rates correctly", async () => {
			searchService.clearCaches()

			const query = "test query"

			// First call - miss
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce([])
			await searchService.searchIndex(query)

			// Second call - hit
			await searchService.searchIndex(query)

			const stats = searchService.getCacheStats()
			expect(stats.searchCacheHits).toBe(1)
			expect(stats.searchCacheMisses).toBe(1)
			expect(stats.searchCacheHitRate).toBe(50)
		})
	})

	describe("Cache Clear", () => {
		it("should clear all caches when clearCaches is called", async () => {
			const query = "test query"

			// Populate cache
			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce([])
			await searchService.searchIndex(query)

			let stats = searchService.getCacheStats()
			expect(stats.searchCacheSize).toBe(1)
			expect(stats.embeddingCacheSize).toBe(1)

			// Clear caches
			searchService.clearCaches()

			stats = searchService.getCacheStats()
			expect(stats.searchCacheSize).toBe(0)
			expect(stats.embeddingCacheSize).toBe(0)
		})
	})

	describe("Backward Compatibility", () => {
		it("should work when feature is disabled", async () => {
			const disabledConfigManager = {
				...mockConfigManager,
				isFeatureEnabled: false,
			} as unknown as CodeIndexConfigManager

			const service = new CodeIndexSearchService(
				disabledConfigManager,
				mockStateManager,
				mockEmbedder,
				mockVectorStore,
			)

			await expect(service.searchIndex("test")).rejects.toThrow(
				"Code index feature is disabled or not configured.",
			)
		})

		it("should work when feature is not configured", async () => {
			const unconfiguredConfigManager = {
				...mockConfigManager,
				isFeatureConfigured: false,
			} as unknown as CodeIndexConfigManager

			const service = new CodeIndexSearchService(
				unconfiguredConfigManager,
				mockStateManager,
				mockEmbedder,
				mockVectorStore,
			)

			await expect(service.searchIndex("test")).rejects.toThrow(
				"Code index feature is disabled or not configured.",
			)
		})

		it("should work when index is not ready", async () => {
			const notReadyStateManager = {
				...mockStateManager,
				getCurrentStatus: vi.fn().mockReturnValue({ systemStatus: "Standby" }),
			} as unknown as CodeIndexStateManager

			const service = new CodeIndexSearchService(
				mockConfigManager,
				notReadyStateManager,
				mockEmbedder,
				mockVectorStore,
			)

			await expect(service.searchIndex("test")).rejects.toThrow("Code index is not ready for search.")
		})

		it("should return empty results when no matches found", async () => {
			const query = "nonexistent query"

			;(mockEmbedder.createEmbeddings as Mock).mockResolvedValueOnce({ embeddings: [[0.1, 0.2, 0.3]] })
			;(mockVectorStore.search as Mock).mockResolvedValueOnce([])

			const results = await searchService.searchIndex(query)
			expect(results).toEqual([])
		})
	})

	describe("Hybrid Search Configuration", () => {
		it("should allow setting hybrid search configuration", () => {
			const newConfig = {
				enabled: false,
				semanticWeight: 0.8,
				keywordWeight: 0.2,
			}

			searchService.setHybridSearchConfig(newConfig)
			const config = searchService.getHybridSearchConfig()

			expect(config.enabled).toBe(false)
			expect(config.semanticWeight).toBe(0.8)
			expect(config.keywordWeight).toBe(0.2)
		})

		it("should ignore invalid configuration", () => {
			const originalConfig = searchService.getHybridSearchConfig()

			searchService.setHybridSearchConfig({ semanticWeight: 1.5 } as any)
			const config = searchService.getHybridSearchConfig()

			// Invalid value should be ignored
			expect(config.semanticWeight).toBe(originalConfig.semanticWeight)
		})
	})
})
