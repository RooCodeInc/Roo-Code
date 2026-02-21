import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Activate a specific intent for the current session to load its architectural constraints, filters, and owned scope. You MUST call this tool at the start of your task (even if the intent is already marked "IN_PROGRESS" in the file) before using any destructive tools.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The ID of the active intent to load (e.g., 'INT-XXX').`

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
