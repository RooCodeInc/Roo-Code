/**
 * Context Engine Module Exports
 * 
 * Provides intelligent context building, intent detection,
 * behavioral analysis, and relevance ranking for AI assistance.
 */

// Context Builder
export {
	ContextBuilder,
	type IContextBuilder,
	type ContextRequest,
	type BuiltContext,
	type ContextItem,
	type ContextMetadata,
	type PriorityItem,
	type RelevantCode,
	PriorityType,
	ContextType,
	MatchType,
} from "./context-builder"

// Intent Detector
export {
	IntentDetector,
	type IIntentDetector,
	type Intent,
	type IntentPattern,
	type UserContext,
	type ActionHistory,
	type Action,
	type ActionPrediction,
	IntentType,
} from "./intent-detector"

// Behavioral Analyzer
export {
	BehavioralAnalyzer,
	type IBehavioralAnalyzer,
	type BehavioralContext,
	type CursorPosition,
	type FileAccess,
	type EditAction,
	type NavigationAction,
	type FocusArea,
	type EditingPattern,
	type NavigationPattern,
	type TimeDistribution,
	type InferredTask,
	type BehavioralStatistics,
} from "./behavioral-analyzer"

// Relevance Ranker
export {
	RelevanceRanker,
	type IRelevanceRanker,
	type RankedContext,
	type ScoreBreakdown,
	type RankingWeights,
	DEFAULT_WEIGHTS,
} from "./relevance-ranker"

// Context Compressor V2
export {
	ContextCompressorV2,
	type CompressionOptions,
	type CompressedContextResult,
} from "./context-compressor-v2"

// Context Engine Service (Main Integration Point)
export {
	ContextEngineService,
	createContextEngineService,
	type ContextEngineConfig,
	type ContextResult,
} from "./context-engine-service"
