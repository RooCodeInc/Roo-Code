import type OpenAI from "openai"

const select_active_intent_DESCRIPTION = `Select the active intent (requirement/task) before making any code changes. You MUST call this tool first when the user asks you to modify, refactor, or write code. The tool returns the intent's constraints and scope so you can act within them. If you attempt a mutating tool (e.g. apply_patch, write_to_file) without having called select_active_intent, the operation will be blocked.`

const select_active_intent = {
	type: "function",
	function: {
		name: "select_active_intent",
		description: select_active_intent_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description:
						"ID of the active intent (e.g. INT-001 or REQ-001 from .orchestration/active_intents.yaml)",
				},
			},
			required: ["intent_id"],
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

export default select_active_intent
