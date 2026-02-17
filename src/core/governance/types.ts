export interface ActiveIntentRecord {
	id: string
	title: string
	description: string
	scope: string[]
	acceptanceCriteria: string[]
	createdAt: string
	updatedAt: string
}

export interface GovernanceTraceRecord {
	timestamp: string
	intentId: string | null
	toolName: string
	argsSummary: string
	argsHash: string
	approved: boolean | null
	decisionReason: string
	status: "success" | "failure" | "blocked"
	durationMs: number
	errorMessage?: string
}

export interface PreToolUseResult {
	allowed: boolean
	intentId: string | null
	approved: boolean | null
	decisionReason: string
	startedAt: number
}
