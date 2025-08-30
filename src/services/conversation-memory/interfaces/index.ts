// Core interfaces for the conversation memory system

export interface ConversationFact {
	id: string
	content: string
	category: FactCategory
	confidence: number

	// Bi-temporal tracking (Graphiti pattern)
	reference_time: Date // When the fact/decision happened
	ingestion_time: Date // When we recorded it

	// Lifecycle tracking (mem0 pattern)
	superseded_by?: string // ID of fact that replaces this
	superseded_at?: Date // When it was superseded
	resolved?: boolean // For debugging facts
	resolved_at?: Date // When it was resolved
	derived_from?: string // For patterns derived from incidents
	derived_pattern_created?: boolean // For debugging incidents after promotion
	last_confirmed?: Date // Last validation

	// Context
	workspace_path: string
	project_context: ProjectContext
	conversation_context: string

	// Vector storage
	embedding: number[]

	// Metadata
	metadata: Record<string, any>
}

export enum FactCategory {
	INFRASTRUCTURE = "infrastructure", // Core tech stack - persistent
	ARCHITECTURE = "architecture", // Design decisions - evolving
	DEBUGGING = "debugging", // Temporary problems - expire
	PATTERN = "pattern", // Solution wisdom - persistent (including promoted incident lessons)
}

export interface ProjectContext {
	language: "typescript" | "python" | "rust" | "go" | "java" | "unknown"
	framework?: string
	workspaceName: string
	packageManager?: "npm" | "yarn" | "pnpm" | "pip" | "cargo" | "maven"
}

export interface MemoryAction {
	type: "ADD" | "UPDATE" | "DELETE" | "NONE"
	fact: CategorizedFact
	target_id?: string // For UPDATE/DELETE
	reasoning: string
}

export interface CategorizedFact {
	content: string
	category: FactCategory
	confidence: number
	embedding: number[]
	reference_time?: Date
	context_description?: string
	reasoning?: string
	tags?: string[]
	subtype?: string
}

export interface ConversationEpisode {
	messages: Message[]
	reference_time: Date
	workspace_path: string
	context_description: string
}

export interface Message {
	role: "user" | "assistant" | "system"
	content: string
	timestamp?: Date
}

export interface FactConflictGroup {
	newFact: CategorizedFact
	existingFacts: ConversationFact[]
}

export interface MemoryStatus {
	systemState: string
	systemMessage: string
	processedEpisodes: number
	totalEpisodes: number
}

export interface MemorySearchOptions {
	limit?: number
	category?: FactCategory
	tags?: string[]
}

// Service interfaces
export interface IFactExtractor {
	extractFacts(messages: Message[], projectContext: ProjectContext): Promise<CategorizedFact[]>
}

export interface IConflictResolver {
	resolveConflicts(
		newFacts: CategorizedFact[],
		existingFacts: ConversationFact[],
		context: ProjectContext,
	): Promise<MemoryAction[]>
}

export interface ITemporalManager {
	cleanupExpiredFacts(): Promise<void>
	calculateTemporalScore(fact: ConversationFact): number
	markFactResolved(factId: string): Promise<void>
	supersedeFact(oldFactId: string, newFactId: string): Promise<void>
	promoteResolvedDebuggingToPattern(fact: ConversationFact, episode?: ConversationEpisode): Promise<void>
}

export interface IConversationProcessor {
	processEpisode(episode: ConversationEpisode): Promise<void>
}

export interface IMemoryVectorStore {
	insert(embeddings: number[][], ids: string[], payloads: any[]): Promise<void>
	search(query: string, embedding: number[], limit: number, filter?: any): Promise<any[]>
	get(id: string): Promise<any | null>
	update(id: string, vector: number[], payload: any): Promise<void>
	delete(id: string): Promise<void>
	clear(): Promise<void>
}
