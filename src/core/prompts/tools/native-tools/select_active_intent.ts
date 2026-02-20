import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent to load its specific context, constraints, and scope. You MUST call this tool before making any changes if an active intent is relevant to your task.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The ID of the active intent to load (e.g., 'INT-001').`

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
