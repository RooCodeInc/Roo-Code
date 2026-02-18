/**
 * select_active_intent tool
 *
 * This tool is called by the agent to select which intent it's working on.
 * It triggers a pre-hook that loads the intent context from .orchestration/active_intents.yaml
 * and injects it into the LLM's context window.
 *
 * @param intent_id - The ID of the intent to work on (e.g., "INT-001")
 * @returns Context XML block with intent details
 */
export const selectActiveIntentTool = {
	name: "select_active_intent",
	description:
		"Select an active intent to work on. Call this first before performing file-modifying or constrained actions. Returns context (scope, constraints, acceptance criteria) for the selected intent.",
	schema: {
		type: "object",
		properties: {
			intent_id: { type: "string", description: "Intent ID in INT-XXX format" },
		},
		required: ["intent_id"],
	},
	// Implementation (handle/execute) will be added in Phase 1
} as const
