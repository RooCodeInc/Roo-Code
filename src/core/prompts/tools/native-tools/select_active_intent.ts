import type OpenAI from "openai"

export const select_active_intent = {
	type: "function",
	function: {
		name: "select_active_intent",
		description:
			"REQUIRED: This tool MUST be called at the start of every session. It loads the active intent constraints. Returns an <intent_context> XML block.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: "The ID of the active intent (e.g., INT-001)",
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
