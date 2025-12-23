import type OpenAI from "openai"

const ASK_MULTIPLE_CHOICE_DESCRIPTION = `Interrupts the current workflow to present structured multiple-choice questions to the user. Forces selection from predefined options (no free-text). Use this tool when you need explicit user decisions or to resolve ambiguity before proceeding.

Use this tool when:
- You need to choose between mutually exclusive options (e.g., architecture patterns, frameworks).
- You need to clarify user intent (e.g., "Add new file?" vs "Update existing?").
- You want to collect multiple related decisions in a single interaction.

CRITICAL: Every question and every option MUST have an id field - results cannot be matched without ids.

Parameters:
- title: (optional) A brief title for the decision group.
- questions: (REQUIRED) An array of question objects (at least 1).
  - id: (REQUIRED) A unique, program-friendly identifier (slug) for the question (e.g., "framework_choice").
  - prompt: (REQUIRED) The text question to display to the user.
  - options: (REQUIRED) An array of option objects (at least 2).
    - id: (REQUIRED) A unique, program-friendly identifier (slug) for the option (e.g., "react", "vue").
    - label: (REQUIRED) The user-facing display text.
  - allow_multiple: (optional) Set to 'true' for checkboxes (multi-select), 'false' for radio buttons (single-select). Defaults to false.

Example: Simple choice
{ "title": "Project Setup", "questions": [{ "id": "framework", "prompt": "Which framework would you like to use?", "options": [{ "id": "react", "label": "React" }, { "id": "vue", "label": "Vue.js" }], "allow_multiple": false }] }

Example: Multiple questions with multi-select
{ "title": "Project Setup", "questions": [{ "id": "framework", "prompt": "Which framework would you like to use?", "options": [{ "id": "react", "label": "React" }, { "id": "vue", "label": "Vue.js" }], "allow_multiple": false }, { "id": "features", "prompt": "Select additional features:", "options": [{ "id": "typescript", "label": "TypeScript" }, { "id": "linting", "label": "ESLint + Prettier" }], "allow_multiple": true }] }`

const TITLE_PARAMETER_DESCRIPTION = `Optional brief title for this group of decisions`

const QUESTIONS_PARAMETER_DESCRIPTION = `Required array of at least one question object to present to the user`

const QUESTION_ID_DESCRIPTION = `Unique program-friendly identifier (slug) for this question`

const QUESTION_PROMPT_DESCRIPTION = `The text question to display to the user`

const QUESTION_OPTIONS_DESCRIPTION = `Required array of at least two option objects that the user can select from`

const OPTION_ID_DESCRIPTION = `Unique program-friendly identifier (slug) for this option`

const OPTION_LABEL_DESCRIPTION = `User-facing display text for this option`

const ALLOW_MULTIPLE_DESCRIPTION = `Set to true for multi-select (checkboxes), false for single-select (radio buttons). Defaults to false`

export default {
	type: "function",
	function: {
		name: "ask_multiple_choice",
		description: ASK_MULTIPLE_CHOICE_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				title: {
					type: ["string", "null"],
					description: TITLE_PARAMETER_DESCRIPTION,
				},
				questions: {
					type: "array",
					description: QUESTIONS_PARAMETER_DESCRIPTION,
					items: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: QUESTION_ID_DESCRIPTION,
							},
							prompt: {
								type: "string",
								description: QUESTION_PROMPT_DESCRIPTION,
							},
							options: {
								type: "array",
								description: QUESTION_OPTIONS_DESCRIPTION,
								items: {
									type: "object",
									properties: {
										id: {
											type: "string",
											description: OPTION_ID_DESCRIPTION,
										},
										label: {
											type: "string",
											description: OPTION_LABEL_DESCRIPTION,
										},
									},
									required: ["id", "label"],
									additionalProperties: false,
								},
								minItems: 2,
							},
							allow_multiple: {
								type: "boolean",
								description: ALLOW_MULTIPLE_DESCRIPTION,
							},
						},
						required: ["id", "prompt", "options"],
						additionalProperties: false,
					},
					minItems: 1,
				},
			},
			required: ["title", "questions"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
