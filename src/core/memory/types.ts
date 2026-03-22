// src/core/memory/types.ts

export interface MemoryEntry {
	id: string
	workspaceId: string | null
	category: MemoryCategorySlug
	content: string
	significance: number
	firstSeen: number
	lastReinforced: number
	reinforcementCount: number
	decayRate: number
	sourceTaskId: string | null
	isPinned: boolean
}

export type MemoryCategorySlug =
	| "coding-style"
	| "communication-prefs"
	| "technical-proficiency"
	| "tool-preferences"
	| "active-projects"
	| "behavioral-patterns"
	| "dislikes-frustrations"

export interface MemoryCategory {
	slug: MemoryCategorySlug
	label: string
	defaultDecayRate: number
	priorityWeight: number
}

export const DEFAULT_MEMORY_CATEGORIES: MemoryCategory[] = [
	{ slug: "coding-style", label: "Coding Style", defaultDecayRate: 0.05, priorityWeight: 0.9 },
	{ slug: "communication-prefs", label: "Communication Preferences", defaultDecayRate: 0.05, priorityWeight: 0.95 },
	{ slug: "technical-proficiency", label: "Technical Proficiency", defaultDecayRate: 0.08, priorityWeight: 0.85 },
	{ slug: "tool-preferences", label: "Tool Preferences", defaultDecayRate: 0.12, priorityWeight: 0.7 },
	{ slug: "active-projects", label: "Active Projects", defaultDecayRate: 0.3, priorityWeight: 0.6 },
	{ slug: "behavioral-patterns", label: "Behavioral Patterns", defaultDecayRate: 0.15, priorityWeight: 0.75 },
	{ slug: "dislikes-frustrations", label: "Dislikes & Frustrations", defaultDecayRate: 0.08, priorityWeight: 0.9 },
]

export type ObservationAction = "NEW" | "REINFORCE" | "UPDATE"

export interface Observation {
	action: ObservationAction
	category: MemoryCategorySlug
	content: string
	significance: number
	existingEntryId: string | null
	reasoning: string
}

export interface AnalysisResult {
	observations: Observation[]
	sessionSummary: string
}

export interface AnalysisLogEntry {
	id: string
	timestamp: number
	taskId: string | null
	messagesAnalyzed: number
	tokensUsed: number
	entriesCreated: number
	entriesReinforced: number
}

export interface ScoredMemoryEntry extends MemoryEntry {
	computedScore: number
	categoryLabel: string
}

export interface PreprocessResult {
	cleaned: string
	originalTokenEstimate: number
	cleanedTokenEstimate: number
}

export const MEMORY_CONSTANTS = {
	MIN_CONTEXT_WINDOW: 50_000,
	DEFAULT_ANALYSIS_FREQUENCY: 8,
	MAX_ENTRIES: 500,
	SCORE_THRESHOLD: 0.05,
	GARBAGE_COLLECTION_SCORE_THRESHOLD: 0.01,
	GARBAGE_COLLECTION_DAYS: 90,
	PROMPT_TOKEN_CAP: 1500,
	MAX_QUERY_ENTRIES: 40,
	DEDUP_SIMILARITY_THRESHOLD: 0.6,
} as const
