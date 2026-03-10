import type OpenAI from "openai"

const WORKSPACE_SYMBOLS_DESCRIPTION = `Request to search for symbols across the entire workspace by name. Uses the VS Code language server to find classes, functions, variables, types, and other symbols that match a query string. Returns up to 100 matching symbols with their names, kinds, file paths, and positions.

Parameters:
- query: (required) The search query to match symbol names against. Can be a partial name (e.g., "User" will match "UserService", "getUser", etc.).

Example: Searching for all symbols containing "Payment"
{ "query": "Payment" }`

export default {
	type: "function",
	function: {
		name: "workspace_symbols",
		description: WORKSPACE_SYMBOLS_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query to match symbol names against",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
