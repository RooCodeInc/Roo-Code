import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Set the active intent context before running side-effect tools. Use this tool to declare which intent is currently being executed and to bind subsequent actions to that intent for traceability and policy checks.

Parameters:
- intent_id: (required) Identifier of the intent to activate.`

const INTENT_ID_DESCRIPTION = `Identifier of the intent to activate`

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
