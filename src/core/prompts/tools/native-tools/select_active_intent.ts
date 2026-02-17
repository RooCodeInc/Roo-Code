import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Request to load intent context for the current task. This tool activates a specific intent by its ID, making the associated context (goals, constraints, and guidelines) available for the current operation. Use this tool when you need to align your actions with a predefined intent.

Parameters:
- intent_id: (required) The unique identifier of the intent to activate

Example: Loading an intent
{ "intent_id": "refactor-auth-module" }`

const INTENT_ID_PARAMETER_DESCRIPTION = `The unique identifier of the intent to load`

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
