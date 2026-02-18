import type OpenAI from "openai"

const description =
	"Select an active intent to load its architectural constraints and business logic context. " +
	"This is a MANDATORY first step for any new task. It reads from .orchestration/active_intents.yaml " +
	"and injects the specific constraints for the given ID into your immediate context."

const properties: Record<string, unknown> = {
	intent_id: {
		type: "string",
		description: "The unique ID of the intent (e.g., 'INT-001') as defined in .orchestration/active_intents.yaml",
	},
}

export const select_active_intent: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "select_active_intent",
		description,
		strict: false,
		parameters: {
			type: "object",
			properties,
			required: ["intent_id"],
			additionalProperties: true,
		},
	},
}

export default select_active_intent
