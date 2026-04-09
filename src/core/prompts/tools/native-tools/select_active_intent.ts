import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select an active intent before performing any destructive operations like writing files, editing code, or executing commands. This is a MANDATORY step that must be completed before any code modifications.

The Intent-Code Traceability system requires you to "checkout" an intent just like you would check out a branch in version control. This ensures:
- You have the correct context for the task
- Your changes are properly tracked and attributed
- Scope violations are prevented

How to Use:
1. First, analyze the user's request to understand what they're asking for
2. Identify the appropriate intent ID from .orchestration/active_intents.yaml
3. Call this tool with the intent_id to load the context
4. Only AFTER selecting an intent, proceed with your task

When to Use:
- Before ANY write_to_file, edit, search_and_replace, or similar file-modifying operations
- Before execute_command if it will modify the codebase
- When starting any new task or subtask

When NOT to Use:
- For read-only operations (read_file, list_files, search_files are safe)
- After you have already selected an intent and are continuing within the same intent

Example: { "intent_id": "INT-001" }

Note: If no active_intents.yaml exists, you must first create the .orchestration directory and define your intents.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The intent ID from .orchestration/active_intents.yaml (e.g., "INT-001", "INT-002")`

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
