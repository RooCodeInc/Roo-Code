import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for ask_followup_question
 * This defines the schema for asking users follow-up questions
 */
export const askFollowupQuestionToolSpec: ToolSpec = {
	name: "ask_followup_question",
	description:
		"Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.",
	parameters: [
		{
			name: "question",
			type: "string",
			required: true,
			description: "A clear, specific question addressing the information needed",
		},
		{
			name: "follow_up",
			type: "string",
			required: true,
			description:
				"A list of 2-4 suggested answers, each in its own <suggest> tag. Suggestions must be complete, actionable answers without placeholders. Optionally include mode attribute to switch modes (code/architect/etc.)",
		},
	],
}
