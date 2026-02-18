import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent by ID from .orchestration/active_intents.yaml. You must call this before destructive operations so file edits are governed by an explicit intent scope.`

const INTENT_ID_PARAMETER_DESCRIPTION = `Intent ID to activate (for example: INT-001)`

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
