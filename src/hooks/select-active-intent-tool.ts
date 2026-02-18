import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select the active intent (requirement/task) before making code changes. You MUST call this tool first when the user asks you to implement, refactor, or change code. It loads the intent's constraints, scope, and acceptance criteria from .orchestration/active_intents.yaml. Do not write code or use write_to_file until you have called select_active_intent with a valid intent_id.`

export const selectActiveIntentToolDefinition = {
	type: "function" as const,
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: "The intent ID from .orchestration/active_intents.yaml (e.g. INT-001)",
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
