import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select and activate a specific intent by ID. This MUST be called before making any code changes.

After selecting an intent, all subsequent work should stay within the intent's owned_scope and obey its constraints. The tool returns an <intent_context> block containing the intent details for prompt injection.

When to use:
- Immediately after list_active_intents, once you choose the correct ID
- At the start of a new task or when switching to a different intent

Parameters:
- intent_id: (required) The ID of the intent to activate (e.g., "INT-001")

Example: Activate intent INT-001
{ "intent_id": "INT-001" }`

const INTENT_ID_DESCRIPTION = `Intent ID to activate (e.g., "INT-001"). Choose from list_active_intents results.`

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
					description: INTENT_ID_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
