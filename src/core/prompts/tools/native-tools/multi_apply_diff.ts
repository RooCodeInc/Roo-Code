import type OpenAI from "openai"

const MULTI_APPLY_DIFF_DESCRIPTION = `Apply precise, targeted modifications to one or more files using search/replace blocks. This tool supports batch operations across multiple files in a single request, maximizing efficiency. For each file, the 'SEARCH' block must exactly match the existing content, including whitespace and indentation. Use the 'read_file' tool first if you are not confident in the exact content to search for.`

const DIFF_PARAMETER_DESCRIPTION = `A string containing one or more search/replace blocks defining the changes. The ':start_line:' is required and indicates the starting line number of the original content. You must not add a start line for the replacement content. Each block must follow this format:
<<<<<<< SEARCH
:start_line:[line_number]
-------
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE`

/**
 * Multi-file apply_diff schema for native tool calling.
 * This schema is used when the MULTI_FILE_APPLY_DIFF experiment is enabled.
 * It allows batch operations across multiple files in a single tool call.
 */
export const multi_apply_diff = {
	type: "function",
	function: {
		name: "apply_diff", // Same name - model sees "apply_diff"
		description: MULTI_APPLY_DIFF_DESCRIPTION,
		parameters: {
			type: "object",
			properties: {
				files: {
					type: "array",
					description:
						"List of files to modify with their diffs. Include multiple files to batch related changes efficiently.",
					items: {
						type: "object",
						properties: {
							path: {
								type: "string",
								description:
									"The path of the file to modify, relative to the current workspace directory.",
							},
							diff: {
								type: "string",
								description: DIFF_PARAMETER_DESCRIPTION,
							},
						},
						required: ["path", "diff"],
						additionalProperties: false,
					},
					minItems: 1,
				},
			},
			required: ["files"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
