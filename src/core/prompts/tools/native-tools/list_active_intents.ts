import type OpenAI from "openai"

const list_active_intents: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "list_active_intents",
		description:
			"Lists all available business intents from the orchestration configuration. Use this to discover which intent_id to use for select_active_intent.",
		parameters: {
			type: "object",
			properties: {},
		},
	},
}

export default list_active_intents
