import { ConversationMemoryConfigManager } from "./config-manager"
import { ConversationMemoryStateManager } from "./state-manager"
import { IEmbedder } from "../code-index/interfaces"
import { IMemoryVectorStore, ITemporalManager, ConversationFact, MemorySearchOptions, FactCategory } from "./interfaces"

export class ConversationMemorySearchService {
	constructor(
		private readonly configManager: ConversationMemoryConfigManager,
		private readonly stateManager: ConversationMemoryStateManager,
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IMemoryVectorStore,
		private readonly temporalManager: ITemporalManager,
	) {}

	public async searchMemory(query: string, options?: MemorySearchOptions): Promise<ConversationFact[]> {
		try {
			// 1. Generate query embedding
			const embeddingResponse = await this.embedder.createEmbeddings([query])
			const queryEmbedding = embeddingResponse.embeddings[0]

			// 2. Build search filter
			const filter: any = {}
			if (options?.category) {
				filter.category = options.category
			}
			if (options?.tags && options.tags.length > 0) {
				filter.tags = { $in: options.tags }
			}

			// 3. Search vector store
			const limit = options?.limit || 10
			const rawResults = await this.vectorStore.search(
				query,
				queryEmbedding,
				limit * 2, // Get more results for temporal filtering
				filter,
			)

			// 4. Apply temporal scoring and filtering
			const scoredResults = rawResults.map((result) => {
				const fact = result.payload as ConversationFact
				const temporalScore = this.temporalManager.calculateTemporalScore(fact)
				return {
					fact,
					temporalScore,
					similarityScore: result.score || 0,
				}
			})

			// 5. Filter by temporal relevance and sort
			const relevantResults = scoredResults
				.filter((result) => result.temporalScore > 0.3) // Minimum relevance threshold
				.sort((a, b) => {
					// Combine similarity and temporal scores
					const aScore = a.similarityScore * 0.7 + a.temporalScore * 0.3
					const bScore = b.similarityScore * 0.7 + b.temporalScore * 0.3
					return bScore - aScore
				})
				.slice(0, limit)
				.map((result) => result.fact)

			return relevantResults
		} catch (error) {
			this.stateManager.setError(`Memory search failed: ${error}`)
			throw error
		}
	}

	public async getRelevantMemoryForPrompt(userMessage: string, maxTokens: number = 400): Promise<string> {
		// Heuristics for automatic memory retrieval
		const messageLower = userMessage.toLowerCase()

		let category: FactCategory | undefined
		let searchQuery = userMessage

		// Detect intent from message
		if (messageLower.includes("error") || messageLower.includes("bug") || messageLower.includes("fix")) {
			category = FactCategory.DEBUGGING
		} else if (
			messageLower.includes("architecture") ||
			messageLower.includes("design") ||
			messageLower.includes("approach")
		) {
			category = FactCategory.ARCHITECTURE
		} else if (
			messageLower.includes("database") ||
			messageLower.includes("deploy") ||
			messageLower.includes("setup")
		) {
			category = FactCategory.INFRASTRUCTURE
		}

		// Search for relevant memories
		const memories = await this.searchMemory(searchQuery, {
			category,
			limit: 6,
		})

		if (memories.length === 0) {
			return ""
		}

		// Format memories for prompt injection
		const formattedMemories = memories.map((fact) => {
			const date = fact.reference_time.toLocaleDateString()
			const categoryLabel = fact.category.toUpperCase()
			let annotation = ""

			if (fact.superseded_by) {
				annotation = " (superseded)"
			} else if (fact.resolved) {
				annotation = " (resolved)"
			} else if (fact.derived_from) {
				annotation = " (derived from incident)"
			}

			return `- ${categoryLabel}: ${fact.content}${annotation} (${date})`
		})

		const memorySection = `# Relevant Memory (auto)\n${formattedMemories.join("\n")}`

		// Simple token estimation (rough approximation)
		const estimatedTokens = memorySection.length / 4
		if (estimatedTokens > maxTokens) {
			// Truncate if too long
			const truncatedMemories = formattedMemories.slice(
				0,
				Math.floor(formattedMemories.length * ((maxTokens * 4) / memorySection.length)),
			)
			return `# Relevant Memory (auto)\n${truncatedMemories.join("\n")}`
		}

		return memorySection
	}
}
