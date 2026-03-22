import type { ModeConfig } from "@roo-code/types"
import * as crypto from "crypto"

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

export const MULTI_ORCHESTRATOR_CONSTANTS = {
	MAX_AGENTS: 6,
	DEFAULT_MAX_AGENTS: 4,
	WORKTREE_PREFIX: "roo-multi-",
	BRANCH_PREFIX: "multi-orch/",
} as const

export function generateAgentId(): string {
	return crypto.randomUUID().slice(0, 8)
}

export function createInitialAgentState(task: PlannedTask): AgentState {
	return {
		taskId: task.id,
		providerId: "",
		panelId: "",
		worktreePath: null,
		worktreeBranch: null,
		mode: task.mode,
		status: "pending",
		title: task.title,
		completionReport: null,
		tokenUsage: null,
		startedAt: null,
		completedAt: null,
	}
}

export function createInitialOrchestratorState(): OrchestratorState {
	return {
		phase: "idle",
		plan: null,
		agents: [],
		mergeResults: [],
		finalReport: null,
	}
}
