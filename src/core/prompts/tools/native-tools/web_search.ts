import type OpenAI from "openai"

const WEB_SEARCH_DESCRIPTION = `Request to perform a web search and retrieve relevant information from the internet. This tool allows you to search for current information, documentation, tutorials, and other web content that may be helpful for completing tasks. Use this when you need up-to-date information that may not be in your training data.`

const QUERY_PARAMETER_DESCRIPTION = `The search query string. Be specific and include relevant keywords for better results.`

export default {
	type: "function",
	function: {
		name: "web_search",
		description: WEB_SEARCH_DESCRIPTION,
		strict: false,
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: QUERY_PARAMETER_DESCRIPTION,
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
