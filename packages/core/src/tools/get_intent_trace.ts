import { intents, Intent } from "./select_active_intent.js"

// Returns the trace info for a given intent, or undefined if none
export function get_intent_trace(intent_id: string): Intent["trace"] {
	const intent = intents[intent_id]
	if (!intent) throw new Error("Invalid intent_id")

	return intent.trace
}
