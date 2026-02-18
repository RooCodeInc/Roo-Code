import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = ` `
const INTENT_ID_DESCRIPTION = ``

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: INTENT_ID_DESCRIPTION,
				},
			},
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
