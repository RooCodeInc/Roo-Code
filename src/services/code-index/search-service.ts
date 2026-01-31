import * as path from "path"
import { VectorStoreSearchResult, HybridSearchConfig, DEFAULT_HYBRID_SEARCH_CONFIG } from "./interfaces"
import { IEmbedder } from "./interfaces/embedder"
import { IVectorStore } from "./interfaces/vector-store"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { regexSearchFiles } from "../ripgrep"
import { performHybridSearch, parseRipgrepResults, validateHybridSearchConfig } from "./hybrid-search"
import * as vscode from "vscode"

/**
 * Service responsible for searching the code index.
 */
export class CodeIndexSearchService {
	/**
	 * Hybrid search configuration
	 */
	private hybridConfig: HybridSearchConfig = { ...DEFAULT_HYBRID_SEARCH_CONFIG }

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
	) {}

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

		try {
			// Generate embedding for query
			const embeddingResponse = await this.embedder.createEmbeddings([query])
			const vector = embeddingResponse?.embeddings[0]
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
				return semanticResults
			}

			// Perform hybrid search fusion
			const hybridResults = performHybridSearch(semanticResults, keywordResults, this.hybridConfig, maxResults)

			// Convert hybrid results back to VectorStoreSearchResult format
			return hybridResults.map((result) => ({
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
