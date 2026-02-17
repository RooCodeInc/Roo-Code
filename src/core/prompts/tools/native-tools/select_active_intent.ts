import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select the active intent ID before any code mutation or command execution that changes state.

Two-stage handshake:
1) Load/inspect available intents from .orchestration/active_intents.yaml context.
2) Call select_active_intent with the chosen intent_id.

All write operations will be blocked unless a valid active intent has been selected for the current task.`

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
					description: "Intent identifier to activate for the current task.",
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
