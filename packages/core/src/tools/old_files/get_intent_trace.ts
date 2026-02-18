import type { Intent } from "./select_active_intent.js"
import { load_intents } from "./select_active_intent.js"

// Return trace info for an intent, undefined if not present
export function get_intent_trace(intent_id?: string): Intent["trace"] {
	if (!intent_id) throw new Error("intent_id is required")

	const intents = load_intents()
	const intent = intents[intent_id]
	if (!intent) throw new Error("Invalid intent_id")

	return intent.trace
}
