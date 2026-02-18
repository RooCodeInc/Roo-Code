import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Mandatory first action for every task. You are an Intent-Driven Architect and CANNOT write code immediately. 

Before proposing any changes or calling write_to_file, you must analyze the user request and call this tool to "checkout" the corresponding intent ID from .orchestration/active_intents.yaml. 

This tool loads the specific high-level architectural constraints, the "owned scope" (authorized files), and the definition of done (acceptance criteria) for the task. You are not authorized to modify files unless they are within the scope of the intent you select.`

const INTENT_ID_DESCRIPTION = `The unique Intent ID (e.g., "INT-001") found in .orchestration/active_intents.yaml that matches the current task.`

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
					description: INTENT_ID_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
