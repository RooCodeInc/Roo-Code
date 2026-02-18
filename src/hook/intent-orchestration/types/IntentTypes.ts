/**
 * Core intent types for the intent orchestration system
 */

export interface IntentConstraint {
	type: "forbid" | "require" | "allow"
	pattern: string
	description?: string
}

export interface IntentScope {
	include: string[]
	exclude: string[]
}

export interface IntentDefinition {
	id: string
	title: string
	description: string
	status: "active" | "completed" | "pending"
	scope: IntentScope
	constraints: IntentConstraint[]
	acceptance_criteria: string[]
	created_at: string
	updated_at: string
}

export interface ActiveIntentsSpec {
	version: string
	active_intents: IntentDefinition[]
}

export interface SelectedIntent {
	intent_id: string
	selected_at: string
	context_injected: boolean
}
