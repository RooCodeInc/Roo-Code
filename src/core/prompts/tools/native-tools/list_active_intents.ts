import type OpenAI from "openai"

const LIST_ACTIVE_INTENT_DESCRIPTION = ``
// TODO: add params here later for the list active intents

export default {
	type: "function",
	function: {
		name: "list_active_intents",
		description: LIST_ACTIVE_INTENT_DESCRIPTION,
	},
} satisfies OpenAI.Chat.ChatCompletionTool
