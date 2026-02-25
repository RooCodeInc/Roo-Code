/**
 * Joe AI Augment Engine — Public API
 *
 * High-context AI assistant with:
 *   - Persistent cross-session memory
 *   - Continuous background codebase indexing
 *   - Smart RAG-based context auto-selection
 *   - Proactive code intelligence
 *   - Multi-file refactor impact analysis
 */

export { AugmentEngine } from "./AugmentEngine"
export { MemoryManager } from "./MemoryManager"
export { ContinuousIndexer } from "./ContinuousIndexer"
export { SmartContextSelector } from "./SmartContextSelector"
export { ProactiveAnalyzer } from "./ProactiveAnalyzer"
export { MultiFileRefactorAnalyzer } from "./MultiFileRefactorAnalyzer"
export { JoeInlineCompletionProvider, registerJoeInlineCompletionProvider } from "./JoeInlineCompletionProvider"

export type { AugmentEngineOptions, EnrichedContext } from "./AugmentEngine"
export type { FileMemory, SessionMemory, WorkspaceMemory } from "./MemoryManager"
export type { IndexingUpdate } from "./ContinuousIndexer"
export type { ContextFile, SmartContextResult } from "./SmartContextSelector"
export type { ProactiveSuggestion, AnalysisResult } from "./ProactiveAnalyzer"
export type { SymbolUsage, ImpactMap, DuplicateBlock } from "./MultiFileRefactorAnalyzer"
