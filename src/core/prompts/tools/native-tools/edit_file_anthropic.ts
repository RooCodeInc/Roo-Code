import type OpenAI from "openai"

const EDIT_FILE_ANTHROPIC_DESCRIPTION = `Edit an existing file by applying one or more exact string replacements.`

const edit_file_anthropic = {
	type: "function",
	function: {
		name: "edit_file_anthropic",
		description: EDIT_FILE_ANTHROPIC_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Path to the file to edit",
				},
				edits: {
					type: "array",
					description: "List of edits to apply sequentially",
					items: {
						type: "object",
						properties: {
							old_text: {
								type: "string",
								description: "Exact text to be replaced",
							},
							new_text: {
								type: "string",
								description: "Replacement text",
							},
						},
						required: ["old_text", "new_text"],
					},
					minItems: 1,
				},
			},
			required: ["path", "edits"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

export default edit_file_anthropic

// Backward compatibility export
export const search_and_replace = edit_file_anthropic
