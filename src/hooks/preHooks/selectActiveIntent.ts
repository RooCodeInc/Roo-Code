/**
 * Pre-hook for select_active_intent
 *
 * Intercepts the select_active_intent call to:
 * 1. Validate the intent ID exists in active_intents.yaml
 * 2. Load intent context (scope, constraints, history)
 * 3. Inject context as XML block into LLM's next prompt
 *
 * This implements the "Reasoning Intercept" from the two-stage state machine.
 */

export interface SelectActiveIntentPreHookArgs {
	intent_id: string
}

export interface SelectActiveIntentPreHookResult {
	blocked: boolean
	context?: string
	error?: string
}

/** Context passed by the host (task, workspace root, etc.). Typed loosely until Phase 1. */
export type SelectActiveIntentPreHookContext = {
	task?: unknown
	workspaceRoot?: string
	[key: string]: unknown
}

export async function selectActiveIntentPreHook(
	args: SelectActiveIntentPreHookArgs,
	context: SelectActiveIntentPreHookContext,
): Promise<SelectActiveIntentPreHookResult> {
	// To be implemented in Phase 1:
	// 1. Read .orchestration/active_intents.yaml from workspaceRoot
	// 2. Find intent with id === args.intent_id; validate INT-XXX format
	// 3. If not found or invalid → return { blocked: true, error: "..." }
	// 4. Build <intent_context> XML (scope, constraints, acceptance_criteria)
	// 5. return { blocked: false, context: xmlBlock }
	return { blocked: false }
}
