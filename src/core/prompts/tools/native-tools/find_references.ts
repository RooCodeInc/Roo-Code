import type OpenAI from "openai"

const FIND_REFERENCES_DESCRIPTION = `Request to find all references to a symbol at a given position in a file. Uses the VS Code language server to locate every place a symbol (function, class, variable, type, etc.) is referenced across the workspace. Returns a list of file paths and positions. Results are capped at 50 locations to keep context size reasonable.

Parameters:
- path: (required) The file path (relative to the current workspace directory) containing the symbol.
- line: (required) The 1-based line number of the symbol.
- character: (required) The 0-based character offset of the symbol on the line.

Example: Finding all references to a function at line 10, character 15
{ "path": "src/services/user.ts", "line": 10, "character": 15 }`

export default {
	type: "function",
	function: {
		name: "find_references",
		description: FIND_REFERENCES_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "File path relative to the workspace containing the symbol",
				},
				line: {
					type: "number",
					description: "1-based line number of the symbol",
				},
				character: {
					type: "number",
					description: "0-based character offset of the symbol on the line",
				},
			},
			required: ["path", "line", "character"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
