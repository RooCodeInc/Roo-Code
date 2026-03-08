import type OpenAI from "openai"

import { DEFAULT_MAX_FOLLOW_UP_SUGGESTIONS } from "@roo-code/types"

function getAskFollowupQuestionDescription(maxSuggestions: number): string {
	return `Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.

Parameters:
- question: (required) A clear, specific question addressing the information needed
- follow_up: (required) A list of 2-${maxSuggestions} suggested answers. Suggestions must be complete, actionable answers without placeholders. Optionally include mode to switch modes (code/architect/etc.)

Example: Asking for file path
{ "question": "What is the path to the frontend-config.json file?", "follow_up": [{ "text": "./src/frontend-config.json", "mode": null }, { "text": "./config/frontend-config.json", "mode": null }, { "text": "./frontend-config.json", "mode": null }] }

Example: Asking with mode switch
{ "question": "Would you like me to implement this feature?", "follow_up": [{ "text": "Yes, implement it now", "mode": "code" }, { "text": "No, just plan it out", "mode": "architect" }] }`
}

const QUESTION_PARAMETER_DESCRIPTION = `Clear, specific question that captures the missing information you need`

function getFollowUpParameterDescription(maxSuggestions: number): string {
	return `Required list of 2-${maxSuggestions} suggested responses; each suggestion must be a complete, actionable answer and may include a mode switch`
}

const FOLLOW_UP_TEXT_DESCRIPTION = `Suggested answer the user can pick`

const FOLLOW_UP_MODE_DESCRIPTION = `Optional mode slug to switch to if this suggestion is chosen (e.g., code, architect)`

export function createAskFollowupQuestionTool(
	maxSuggestions: number = DEFAULT_MAX_FOLLOW_UP_SUGGESTIONS,
): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: "ask_followup_question",
			description: getAskFollowupQuestionDescription(maxSuggestions),
			strict: true,
			parameters: {
				type: "object",
				properties: {
					question: {
						type: "string",
						description: QUESTION_PARAMETER_DESCRIPTION,
					},
					follow_up: {
						type: "array",
						description: getFollowUpParameterDescription(maxSuggestions),
						items: {
							type: "object",
							properties: {
								text: {
									type: "string",
									description: FOLLOW_UP_TEXT_DESCRIPTION,
								},
								mode: {
									type: ["string", "null"],
									description: FOLLOW_UP_MODE_DESCRIPTION,
								},
							},
							required: ["text", "mode"],
							additionalProperties: false,
						},
						minItems: 1,
						maxItems: maxSuggestions,
					},
				},
				required: ["question", "follow_up"],
				additionalProperties: false,
			},
		},
	} satisfies OpenAI.Chat.ChatCompletionTool
}

// Backward compatibility: default export with default maxItems
export default createAskFollowupQuestionTool()
