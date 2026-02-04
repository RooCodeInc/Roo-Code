/**
 * Memory Services Module Exports
 * 
 * Provides persistent memory capabilities for conversations,
 * project decisions, patterns, and context.
 */

// Interfaces
export * from "./interfaces"

// Storage
export { SQLiteAdapter, type StorageAdapter } from "./storage/sqlite-adapter"

// Memory Manager
export { MemoryManager } from "./memory-manager"

// Conversation Memory
export {
	ConversationMemory,
	type Conversation,
	type Message,
	type ExtractedKnowledge,
	type ConversationQuery,
	type SemanticSearchResult,
	type IConversationMemory,
} from "./conversation-memory"

// Project Memory
export {
	ProjectMemoryImpl,
	type ProjectMemory,
	type DesignDecision,
	type BestPractice,
	type ProjectContext,
	type HistoricalContext,
	type ProjectSearchResult,
	type DesignDecisionQuery,
} from "./project-memory"

// Pattern Memory
export {
	PatternMemoryImpl,
	type PatternMemory,
	type CodePattern,
	type PatternContext,
	type PatternOccurrence,
	type PatternSuggestion,
	type PatternQuery,
	type PatternStatistics,
} from "./pattern-memory"
