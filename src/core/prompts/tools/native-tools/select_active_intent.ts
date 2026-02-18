import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Selects and loads an active intent from the .orchestration/active_intents.yaml sidecar file.

This tool MUST be called before any mutating tool (write_to_file, execute_command, apply_diff, etc.).
It loads the constraints, owned_scope, and acceptance_criteria for the selected intent and injects
them into the agent's context. The agent must cite a valid intent ID from the active_intents.yaml file.

Returns an <intent_context> XML block with the intent's full specification.`

const INTENT_ID_DESCRIPTION = `The ID of the intent to activate (e.g., "INT-001"). Must match an id field in .orchestration/active_intents.yaml.`

const MUTATION_CLASS_DESCRIPTION = `The planned mutation class for this work session:
- AST_REFACTOR: Restructuring existing code without changing behaviour (rename, extract, move)
- INTENT_EVOLUTION: Adding new behaviour, new feature, or new requirement`

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
				mutation_class: {
					type: "string",
					enum: ["AST_REFACTOR", "INTENT_EVOLUTION"],
					description: MUTATION_CLASS_DESCRIPTION,
				},
			},
			required: ["intent_id", "mutation_class"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
