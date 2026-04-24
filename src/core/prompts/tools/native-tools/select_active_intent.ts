import type OpenAI from "openai"

/**
 * Tool for selecting an active intent before making code changes.
 * This enforces the Reasoning Loop protocol.
 */
const selectActiveIntent: OpenAI.Chat.ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "select_active_intent",
		description:
			"Select an active intent from active_intents.yaml before making code changes. This is REQUIRED before using any code modification tools (write_to_file, edit_file, etc.). The intent provides context about scope, constraints, and acceptance criteria.",
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description:
						"The ID of the intent to activate (e.g., 'INT-001'). Must exist in .orchestration/active_intents.yaml",
				},
			},
			required: ["intent_id"],
		},
	},
}

export default selectActiveIntent
