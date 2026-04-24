import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Load the active intent context from .orchestration/active_intents.yaml by intent ID. Use this before planning or coding so constraints and scope are explicitly available in the next turn.`

const INTENT_ID_PARAMETER_DESCRIPTION = `Intent ID to load from .orchestration/active_intents.yaml (for example: intent-1)`

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
