import type OpenAI from "openai"

const GET_ACTIVE_INTENT_DESCRIPTION = `Gets the currently active intent for this task. Returns detailed information about the intent including its ID, name, description, status, scope, constraints, and acceptance criteria. If no intent is active, returns a message indicating that an intent needs to be selected.

This tool is useful for:
- Checking which intent is currently governing operations
- Understanding what files/areas are authorized for modification
- Reviewing intent constraints and acceptance criteria

No parameters required.`

export default {
	type: "function",
	function: {
		name: "get_active_intent",
		description: GET_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {},
			required: [],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
