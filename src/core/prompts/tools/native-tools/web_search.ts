import type OpenAI from "openai"

const WEB_SEARCH_DESCRIPTION = `Search the public web for up-to-date information and return a concise list of results with titles, URLs, and snippets. Use this tool when you need real-time or external context that is not available in the local workspace.

Parameters:
- query: (required) The search query to run.
- max_results: (optional) Maximum number of results to return (default: 5, max: 10).

Example: Searching for release notes
{ "query": "Cline 3.48.0 web search tool", "max_results": 5 }`

const QUERY_PARAMETER_DESCRIPTION = `Search query string`

const MAX_RESULTS_PARAMETER_DESCRIPTION = `Optional cap on number of results (1-10)`

export default {
	type: "function",
	function: {
		name: "web_search",
		description: WEB_SEARCH_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: QUERY_PARAMETER_DESCRIPTION,
				},
				max_results: {
					type: ["integer", "null"],
					description: MAX_RESULTS_PARAMETER_DESCRIPTION,
				},
			},
			required: ["query", "max_results"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
