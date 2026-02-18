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
 * to reduce the LLM's solution space through structured constraints.[1]
 */
export interface WBSContext {
	id: string // e.g., "INT-001"
	owned_scope: string // Glob patterns of authorized files
	what: string // Functional requirements
	boundaries: string // "Soft constraints" to prevent hallucinations [1]
	success: string // Measurable criteria for the "Definition of Done"
}

/**
 * TraceRecord follows the Agent Trace specification to provide
 * a position-independent audit log of AI contributions.
 */
export interface TraceRecord {
	version: string // Specification version (e.g., "1.0")
	id: string // Unique UUID for the trace event
	timestamp: string // ISO 8601 recorded time
	vcs?: {
		type: "git" | "jj" | "hg" | "svn"
		revision: string // VCS-specific revision hash
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
				// Content hash H for spatial independence
				content_hash?: string
			}>
		}>
	}>
}
