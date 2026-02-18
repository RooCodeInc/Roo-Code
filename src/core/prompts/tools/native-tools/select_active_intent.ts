import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent from the workspace's .orchestration/active_intents.yaml file. This tool MUST be called before performing any write operations (write_to_file, apply_diff, edit, search_and_replace).

This tool loads the intent context including:
- Intent description and constraints
- Allowed file scope patterns
- Traceability metadata

Once an intent is selected, you may only modify files within the specified scope. Attempting to write files outside the scope will be blocked.

Example: Selecting an intent
{ "intent_id": "INT-001" }`

const INTENT_ID_PARAMETER_DESCRIPTION = `The ID of the intent to select from active_intents.yaml (e.g., "INT-001", "feature-auth-system")`

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: INTENT_ID_PARAMETER_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
