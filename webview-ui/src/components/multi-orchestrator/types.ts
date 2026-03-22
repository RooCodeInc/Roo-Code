/**
 * Local mirror of multi-orchestrator types for the webview UI.
 *
 * These duplicate the interfaces defined in `src/core/multi-orchestrator/types.ts`
 * because the webview bundle cannot import from the extension host source directly.
 * Keep in sync with the canonical definitions when modifying.
 */

export interface OrchestratorPlan {
	tasks: PlannedTask[]
	requiresMerge: boolean
	estimatedComplexity: "low" | "medium" | "high"
}

export interface PlannedTask {
	id: string
	mode: string
	title: string
	description: string
	assignedFiles?: string[]
	priority: number
}

export type AgentStatus = "pending" | "running" | "completed" | "failed" | "merging"

export interface AgentState {
	taskId: string
	providerId: string
	panelId: string
	worktreePath: string | null
	worktreeBranch: string | null
	mode: string
	status: AgentStatus
	title: string
	completionReport: string | null
	tokenUsage: { input: number; output: number } | null
	startedAt: number | null
	completedAt: number | null
}

export interface MergeResult {
	agentTaskId: string
	branch: string
	success: boolean
	conflictsFound: number
	conflictsResolved: number
	filesChanged: string[]
}

export interface OrchestratorState {
	phase: "idle" | "planning" | "spawning" | "running" | "merging" | "reporting" | "complete"
	plan: OrchestratorPlan | null
	agents: AgentState[]
	mergeResults: MergeResult[]
	finalReport: string | null
}
