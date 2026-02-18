import { load_intents } from "./load_intents.js"

// Intent type
export type Intent = {
	description: string
	constraints: string[]
	scope: string[]
	trace?: {
		files: string[]
		functions: string[]
	}
}

// Utility to escape XML special characters
function escapeXml(str: string) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Returns intent info as XML
export function select_active_intent(intent_id: string): string {
	const intents = load_intents()
	const intent = intents[intent_id]
	if (!intent) throw new Error("Invalid intent_id")

	return `<intent_context>
  <description>${escapeXml(intent.description)}</description>
  <constraints>${escapeXml(intent.constraints.join(", "))}</constraints>
  <scope>${escapeXml(intent.scope.join(", "))}</scope>
</intent_context>`
}

// Returns the trace info for a given intent, or undefined if none
export function get_intent_trace(intent_id: string): Intent["trace"] {
	const intents = load_intents()
	const intent = intents[intent_id]
	if (!intent) throw new Error("Invalid intent_id")
	return intent.trace
}
