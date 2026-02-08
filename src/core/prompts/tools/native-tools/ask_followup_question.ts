import type OpenAI from "openai"

const ASK_FOLLOWUP_QUESTION_DESCRIPTION = `Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.

Parameters:
- questions: (required) A list of questions to ask. Each question can be a simple string or an object with "text" and "options" for multiple choice.
- follow_up: (required) A list of 2-4 suggested answers. Suggestions must be complete, actionable answers without placeholders. Optionally include mode to switch modes (code/architect/etc.)

Example: Asking for file path
{ "questions": ["What is the path to the frontend-config.json file?"], "follow_up": [{ "text": "./src/frontend-config.json", "mode": null }, { "text": "./config/frontend-config.json", "mode": null }, { "text": "./frontend-config.json", "mode": null }] }

Example: Asking with multiple questions and choices
{
  "questions": [
    { "text": "Which framework are you using?", "options": ["React", "Vue", "Svelte", "Other"] },
    "What is your project name?",
    { "text": "Include telemetry?", "options": ["Yes", "No"] }
  ],
  "follow_up": [{ "text": "I've answered the questions", "mode": null }]
}

Example: Asking with mode switch
{ "questions": ["Would you like me to implement this feature?"], "follow_up": [{ "text": "Yes, implement it now", "mode": "code" }, { "text": "No, just plan it out", "mode": "architect" }] }`

const QUESTIONS_PARAMETER_DESCRIPTION = `List of questions to ask. Each question can be a string or an object with "text" and "options" for multiple choice.`

const FOLLOW_UP_PARAMETER_DESCRIPTION = `Required list of 2-4 suggested responses; each suggestion must be a complete, actionable answer and may include a mode switch`

const FOLLOW_UP_TEXT_DESCRIPTION = `Suggested answer the user can pick`

const FOLLOW_UP_MODE_DESCRIPTION = `Optional mode slug to switch to if this suggestion is chosen (e.g., code, architect)`

export default {
	type: "function",
	function: {
		name: "ask_followup_question",
		description: ASK_FOLLOWUP_QUESTION_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				questions: {
					type: "array",
					items: {
						anyOf: [
							{
								type: "string",
							},
							{
								type: "object",
								properties: {
									text: { type: "string" },
									options: {
										type: "array",
										items: { type: "string" },
									},
								},
								required: ["text", "options"],
								additionalProperties: false,
							},
						],
					},
					description: QUESTIONS_PARAMETER_DESCRIPTION,
					minItems: 1,
				},
				follow_up: {
					type: "array",
					description: FOLLOW_UP_PARAMETER_DESCRIPTION,
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
					maxItems: 4,
				},
			},
			required: ["questions", "follow_up"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
