import type OpenAI from "openai"

const select_active_intent: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "select_active_intent",
		description:
			"Selects an active business intent from the orchestration configuration. This is a mandatory first step before any codebase modifications (files or commands). Selecting an intent loads architectural constraints and owned scope into the task context.",
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: "The unique ID of the intent to activate (e.g., 'WEEK1_REASONING_LOOP').",
				},
			},
			required: ["intent_id"],
		},
	},
}

export default select_active_intent
