import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `
Select and activate an intent from active_intents.json.\n
This must be called before making any changes to understand what changes are intended.\n
`
const INTENT_ID_DESCRIPTION = `The intent_id for the currently selected intent by the LLM and will be activated by LLM`

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
