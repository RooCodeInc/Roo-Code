import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select and checkout the active intent for this turn before performing any code edits. This tool loads intent constraints, related files, and recent history from .orchestration/active_intents.yaml.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The intent identifier to activate for this turn`

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
