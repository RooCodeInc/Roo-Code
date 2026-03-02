import type OpenAI from "openai"

const READ_LINTS_DESCRIPTION = `Read linter errors and warnings from the workspace. Use this after editing files to check for problems. If no paths are provided, returns diagnostics only for files that have been edited in this task. If paths are provided, returns diagnostics for those files or directories (relative to the current workspace directory).

Parameters:
- paths: (optional) Array of file or directory paths to get diagnostics for. If omitted, returns diagnostics for files edited in this task (or a message if none edited yet).

Example: Get lints for files edited in this task
{ }

Example: Get lints for a specific file
{ "paths": ["src/foo.ts"] }

Example: Get lints for a directory
{ "paths": ["src"] }`

const PATHS_PARAMETER_DESCRIPTION = `Optional array of file or directory paths (relative to workspace) to get diagnostics for. If omitted, returns diagnostics only for files edited in this task.`

export default {
	type: "function",
	function: {
		name: "read_lints",
		description: READ_LINTS_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				paths: {
					type: "array",
					items: { type: "string" },
					description: PATHS_PARAMETER_DESCRIPTION,
				},
			},
			required: [],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
