import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select the active intent to work on before performing file-modifying or constrained actions. You MUST call this tool first with a valid intent ID (format INT-XXX, e.g. INT-001) from .orchestration/active_intents.yaml. The tool returns the intent's scope, constraints, and acceptance criteria for the current turn.`

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
					description: "Intent ID in INT-XXX format (e.g. INT-001)",
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
