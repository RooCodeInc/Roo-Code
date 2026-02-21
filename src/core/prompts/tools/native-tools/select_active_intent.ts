import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent to load architectural constraints and context before making code changes. This tool MUST be called before any write_to_file, edit_file, or apply_diff operations.

An intent represents a specific feature, bug fix, or refactoring task with:
- Scope constraints (which files can be modified)
- Architectural guidelines
- Acceptance criteria
- Related specifications

By selecting an intent, you declare what you're working on and receive structured context that helps you stay within architectural boundaries.

Example: Selecting an intent before implementing a feature
{ "intent_id": "INT-001" }

After selection, the intent's context will be automatically injected into your subsequent prompts, ensuring your changes align with the defined scope and constraints.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The intent ID from .orchestration/active_intents.yaml (e.g., "INT-001", "FEAT-042"). You must select an intent before making any code modifications.`

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
