import type OpenAI from "openai"

/**
 * Tool for creating a new intent based on a prompt.
 * Checks for architecture.md and uses it to create the intent.
 */
const createIntent: OpenAI.Chat.ChatCompletionFunctionTool = {
	type: "function",
	function: {
		name: "create_intent",
		description:
			"Create a new intent in active_intents.yaml based on a prompt. This tool checks for architecture.md first. If architecture.md doesn't exist, it will ask the user if they want to create it. The intent will be created with inferred scope, constraints, and acceptance criteria based on the prompt and architecture.md.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"The prompt describing what the intent should cover. This is used to infer scope, constraints, and acceptance criteria.",
				},
				intent_id: {
					type: "string",
					description:
						"Optional: The ID for the new intent (e.g., 'INT-008'). If not provided, the next available ID will be generated automatically.",
				},
				intent_name: {
					type: "string",
					description:
						"Optional: The name for the new intent. If not provided, it will be generated from the prompt.",
				},
				owned_scope: {
					type: "array",
					items: {
						type: "string",
					},
					description:
						"Optional: Array of file path patterns (glob patterns) that this intent owns. If not provided, it will be inferred from the prompt.",
				},
				constraints: {
					type: "array",
					items: {
						type: "string",
					},
					description:
						"Optional: Array of constraints for this intent. If not provided, it will be inferred from the prompt.",
				},
				acceptance_criteria: {
					type: "array",
					items: {
						type: "string",
					},
					description:
						"Optional: Array of acceptance criteria for this intent. If not provided, it will be inferred from the prompt.",
				},
			},
			required: ["prompt"],
		},
	},
}

export default createIntent
