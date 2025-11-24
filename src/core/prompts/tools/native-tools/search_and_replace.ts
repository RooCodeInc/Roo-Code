import type OpenAI from "openai"

const SEARCH_AND_REPLACE_DESCRIPTION = `Perform one or more text replacements in a file. This tool finds and replaces exact text matches. Use this for straightforward replacements where you know the exact text to find and replace. You can perform multiple replacements in a single call by providing an array of operations. For complex multi-line changes or when you need line number precision, use apply_diff instead.`

const search_and_replace = {
	type: "function",
	function: {
		name: "search_and_replace",
		description: SEARCH_AND_REPLACE_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "The path of the file to modify, relative to the current workspace directory.",
				},
				operations: {
					type: "array",
					description: "Array of search and replace operations to perform on the file.",
					items: {
						type: "object",
						properties: {
							search: {
								type: "string",
								description:
									"The exact text to find in the file. Must match exactly, including whitespace.",
							},
							replace: {
								type: "string",
								description: "The text to replace the search text with.",
							},
						},
						required: ["search", "replace"],
					},
					minItems: 1,
				},
			},
			required: ["path", "operations"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

export default search_and_replace
