import type OpenAI from "openai"

const DOCUMENT_SYMBOLS_DESCRIPTION = `Request to list all symbols defined in a specific file. Uses the VS Code language server to enumerate all functions, classes, methods, variables, types, and other symbols in the document. Returns a flat list of symbols with their names, kinds, and line ranges.

Parameters:
- path: (required) The file path (relative to the current workspace directory) to analyze.

Example: Listing all symbols in a TypeScript file
{ "path": "src/services/auth.ts" }`

export default {
	type: "function",
	function: {
		name: "document_symbols",
		description: DOCUMENT_SYMBOLS_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "File path relative to the workspace to analyze",
				},
			},
			required: ["path"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
