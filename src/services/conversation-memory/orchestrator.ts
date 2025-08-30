import { ConversationMemoryConfigManager } from "./config-manager"
import { ConversationMemoryStateManager } from "./state-manager"
import { ConversationMemoryCacheManager } from "./cache-manager"
import {
	IMemoryVectorStore,
	IFactExtractor,
	IConflictResolver,
	ITemporalManager,
	IConversationProcessor,
	ConversationEpisode,
	ConversationFact,
	FactCategory,
} from "./interfaces"

export class ConversationMemoryOrchestrator {
	private isProcessing = false

	constructor(
		private readonly configManager: ConversationMemoryConfigManager,
		private readonly stateManager: ConversationMemoryStateManager,
		private readonly workspacePath: string,
		private readonly cacheManager: ConversationMemoryCacheManager,
		private readonly vectorStore: IMemoryVectorStore,
		private readonly factExtractor: IFactExtractor,
		private readonly conflictResolver: IConflictResolver,
		private readonly temporalManager: ITemporalManager,
		private readonly conversationProcessor: IConversationProcessor,
	) {}

	public get state(): string {
		return this.isProcessing ? "Processing" : "Standby"
	}

	public async processConversationEpisode(episode: ConversationEpisode): Promise<void> {
		if (this.isProcessing) {
			console.log("Already processing a conversation episode")
			return
		}

		this.isProcessing = true
		this.stateManager.setProcessingState("Processing conversation episode")

		try {
			// 1. Extract facts from the conversation
			const projectContext = {
				language: "typescript" as const,
				workspaceName: this.workspacePath,
				framework: undefined,
				packageManager: "npm" as const,
			}

			const newFacts = await this.factExtractor.extractFacts(episode.messages, projectContext)

			if (newFacts.length === 0) {
				console.log("No facts extracted from conversation")
				return
			}

			// 2. Find conflicting facts via vector similarity
			const existingFacts = this.cacheManager.getAllFacts()

			// 3. Resolve conflicts
			const memoryActions = await this.conflictResolver.resolveConflicts(newFacts, existingFacts, projectContext)

			// 4. Apply memory actions
			for (const action of memoryActions) {
				if (action.type === "ADD") {
					const fact: ConversationFact = {
						id: this.generateFactId(),
						content: action.fact.content,
						category: action.fact.category,
						confidence: action.fact.confidence,
						reference_time: episode.reference_time,
						ingestion_time: new Date(),
						workspace_path: this.workspacePath,
						project_context: projectContext,
						conversation_context: episode.context_description,
						embedding: action.fact.embedding,
						metadata: {},
					}

					// Store in cache and vector store
					this.cacheManager.setFact(fact)
					await this.vectorStore.insert([fact.embedding], [fact.id], [fact])
				}
				// TODO: Handle UPDATE and DELETE actions
			}

			// 5. Cleanup expired facts
			await this.temporalManager.cleanupExpiredFacts()

			// 6. Save cache
			await this.cacheManager.saveCache()

			this.stateManager.setSystemState("Standby", "Processing complete")
		} catch (error) {
			console.error("Error processing conversation episode:", error)
			this.stateManager.setError(`Processing failed: ${error}`)
		} finally {
			this.isProcessing = false
		}
	}

	public stopProcessing(): void {
		this.isProcessing = false
		this.stateManager.setSystemState("Standby", "Processing stopped")
	}

	public async clearMemoryData(): Promise<void> {
		await this.vectorStore.clear()
		await this.cacheManager.clearCacheFile()
		this.stateManager.setSystemState("Standby", "Memory data cleared")
	}

	private generateFactId(): string {
		return `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}
}
