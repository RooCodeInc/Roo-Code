/**
 * Data models for the .orchestration/ directory
 * Based on the challenge specification
 */

export interface ActiveIntent {
	id: string // e.g., "INT-001"
	name: string // Human-readable name
	status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"
	owned_scope: string[] // File patterns this intent can modify
	constraints: string[] // Business/technical constraints
	acceptance_criteria: string[] // Definition of Done
}

export interface ActiveIntentsFile {
	active_intents: ActiveIntent[]
}

export interface AgentTraceEntry {
	id: string // UUID v4
	timestamp: string // ISO 8601
	vcs: {
		revision_id: string // Git SHA
	}
	files: {
		relative_path: string
		conversations: {
			url: string // Session log ID
			contributor: {
				entity_type: "AI" | "HUMAN"
				model_identifier?: string // e.g., "claude-3.5-sonnet"
			}
			ranges: {
				start_line: number
				end_line: number
				content_hash: string // SHA-256 of the code block
			}[]
			related: {
				type: "specification" | "requirement"
				value: string // Intent ID or requirement ID
			}[]
		}[]
	}[]
	mutation_class?: "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX" | "DOCUMENTATION"
}
