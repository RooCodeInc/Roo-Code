import type OpenAI from "openai"

const webSearch: OpenAI.Chat.ChatCompletionTool = {
	type: "function",
	function: {
		name: "web_search",
		description:
			"Search the web for information. Returns a list of results with title, URL, and snippet. Useful for finding documentation, researching technologies, fact-checking, and gathering information that may not be in the local codebase. Requires a search backend to be configured (Brave, Tavily, or SearXNG).",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The search query string.",
				},
				max_results: {
					type: "number",
					description: "Maximum number of results to return (default: 5, max: 20).",
				},
				search_type: {
					type: "string",
					enum: ["general", "code", "docs"],
					description:
						'Type of search to perform. "general" for broad searches, "code" for code-specific results, "docs" for documentation. Default: "general".',
				},
			},
			required: ["query"],
		},
	},
}

export default webSearch
