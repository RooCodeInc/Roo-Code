import type OpenAI from "openai"

const GO_TO_DEFINITION_DESCRIPTION = `Request to find the definition of a symbol at a given position in a file. Uses the VS Code language server to locate where a symbol (function, class, variable, type, etc.) is defined. Returns the file path and position of the definition.

Parameters:
- path: (required) The file path (relative to the current workspace directory) containing the symbol.
- line: (required) The 1-based line number of the symbol.
- character: (required) The 0-based character offset of the symbol on the line.

Example: Finding the definition of a function call at line 15, character 8
{ "path": "src/utils/auth.ts", "line": 15, "character": 8 }`

export default {
	type: "function",
	function: {
		name: "go_to_definition",
		description: GO_TO_DEFINITION_DESCRIPTION,
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
