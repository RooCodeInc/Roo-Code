/**
 * Intent-Driven Architecture Protocol section for the system prompt.
 *
 * This section is ONLY included when the workspace is in "governed mode"
 * (i.e., .orchestration/active_intents.yaml exists). It instructs the LLM
 * to call select_active_intent as its very first action.
 */
export function getIntentProtocolSection(): string {
	return `====

INTENT-DRIVEN ARCHITECTURE PROTOCOL

This workspace has governance enabled (.orchestration/active_intents.yaml exists).

You are an Intent-Driven Architect. Before performing ANY action, you MUST:
1. Analyze the user's request to determine which active intent applies.
2. Call select_active_intent(intent_id) to load the context for that intent.
3. Only after receiving the <intent_context> response may you proceed with other tools.

⚠️ CRITICAL: You CANNOT use any other tools until you have successfully selected an intent.
If you try, they will be blocked with an error requiring you to select an intent first.`
}
