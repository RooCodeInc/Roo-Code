/**
 * TRP1 Hook Engine Type Definitions
 * Core interfaces for the Intent-Driven IDE governance system
 */

export interface HookContext {
	toolName: string
	toolParams: Record<string, any>
	activeIntentId: string | undefined
	sessionId: string
	workspaceRoot: string
	filePath?: string
}

export interface HookResult {
	allow: boolean
	modifiedParams?: Record<string, any>
	injectedContext?: string
	error?: string
}

export interface IntentMetadata {
	id: string
	name: string
	status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED"
	created_at: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	last_trace_ref?: string
}

export interface ActiveIntent {
	active_intents: IntentMetadata[]
}

export interface AgentTraceRecord {
	id: string
	timestamp: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION" | "BUG_FIX"
	vcs: {
		type: string
		revision_id: string
	}
	session_id: string
	files: AgentTraceFile[]
}

export interface AgentTraceFile {
	relative_path: string
	conversations: AgentTraceConversation[]
}

export interface AgentTraceConversation {
	url: string
	contributor: {
		entity_type: "AI" | "Human" | "Mixed" | "Unknown"
		model_identifier: string
	}
	ranges: AgentTraceRange[]
	related: AgentTraceRelated[]
}

export interface AgentTraceRange {
	start_line: number
	end_line: number
	content_hash: string
}

export interface AgentTraceRelated {
	type: "specification" | "issue" | "documentation"
	value: string
}

export enum CommandClassification {
	SAFE_READ = "SAFE_READ",
	SAFE_BUILD = "SAFE_BUILD",
	DESTRUCTIVE = "DESTRUCTIVE",
	NETWORK = "NETWORK",
	AMBIGUOUS = "AMBIGUOUS",
}

export interface FileHash {
	path: string
	hash: string
	timestamp: number
}
