import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent by ID.

This is a mandatory handshake step for intent-driven development.

You MUST call this tool before any file modifications (write_to_file, edit, apply_diff, edit_file, apply_patch, etc.) or system changes (execute_command).`

const INTENT_ID_PARAMETER_DESCRIPTION = `The intent ID to activate (must exist in .orchestration/active_intents.yaml)`

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
					description: INTENT_ID_PARAMETER_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
