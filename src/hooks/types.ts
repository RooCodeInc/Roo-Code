/**
 * MutationClass differentiates between changes that preserve existing
 * business logic (Refactor) and those that introduce new requirements (Evolution).
 */
export enum MutationClass {
	AST_REFACTOR = "AST_REFACTOR",
	INTENT_EVOLUTION = "INTENT_EVOLUTION",
}

/**
 * WBSContext formalizes the "What-Boundaries-Success" framework
 * to reduce the LLM's solution space through structured constraints.
 */
export interface WBSContext {
	id: string // e.g., "INT-001"
	owned_scope: string[] // Glob patterns of authorized files
	what: string[] // Functional requirements
	boundaries: string[] // "Soft constraints" to prevent hallucinations
	success: string[] // Measurable criteria for "Definition of Done"
}

/**
 * TraceRecord follows the Agent Trace specification to provide
 * a position-independent audit log of AI contributions.
 */
export interface TraceRecord {
	version: string
	id: string
	timestamp: string
	vcs?: {
		type: "git" | "jj" | "hg" | "svn"
		revision: string
	}
	files: Array<{
		path: string
		conversations: Array<{
			contributor: {
				type: "human" | "ai" | "mixed" | "unknown"
				model_id?: string
			}
			ranges: Array<{
				start_line: number
				end_line: number
				content_hash?: string
			}>
		}>
	}>
}
