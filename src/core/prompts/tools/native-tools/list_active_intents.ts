import type OpenAI from "openai"

const LIST_ACTIVE_INTENTS_DESCRIPTION = `List all currently active intents available for selection. Use this tool when you need to choose which intent to work on before making any code changes.

This tool reads the workspace intent registry (typically .orchestration/active_intents.json) and returns a compact list of intents with:
- id
- name
- status
- owned_scope (high-level scope paths)
- constraints (short summary)
- acceptance_criteria (short summary)

When to use:
- At the start of a task, before calling select_active_intent
- When you are unsure which intent ID applies
- When select_active_intent fails due to an invalid ID

Example: List all available active intents
{}`

export default {
	type: "function",
	function: {
		name: "list_active_intents",
		description: LIST_ACTIVE_INTENTS_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {},
			additionalProperties: false,
			required: [],
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
