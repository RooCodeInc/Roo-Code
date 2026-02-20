import type OpenAI from "openai"

const selectActiveIntent: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "select_active_intent",
		description:
			"Load the context and constraints for a specific intent before performing any code mutations or structural changes. This MUST be called before any write_file, apply_diff, or execute_command operations. The intent provides the scope, constraints, and definition of done for the current session.",
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description:
						"The unique identifier of the intent to activate (e.g., 'INT-001', 'task-refactor-auth'). This intent should be defined in the .orchestration/active_intents.yaml file.",
				},
			},
			required: ["intent_id"],
		},
	},
}

export default selectActiveIntent
