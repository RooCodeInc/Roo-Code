import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent that governs subsequent tool operations. This intent defines the scope and constraints for file modifications and command executions. Only one intent can be active per task at a time. Selecting a new intent replaces the previous active intent.

You MUST select an active intent before performing any destructive operations (write_to_file, execute_command, etc.). The system will block operations that are not authorized by the active intent's scope.

Parameters:
- intent_id: (required) The ID of the intent to activate (e.g., "INT-001"). Must exist in active_intents.yaml.

Example: Selecting intent INT-001
{ "intent_id": "INT-001" }`

const INTENT_ID_PARAMETER_DESCRIPTION = `The unique identifier of the intent to activate (e.g., "INT-001")`

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
