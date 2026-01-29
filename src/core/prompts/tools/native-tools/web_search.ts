import type OpenAI from "openai"

const WEB_SEARCH_DESCRIPTION = `Performs a web search and returns relevant results with titles and URLs.

Use this tool when you need to search the web for information. The search returns a list of results with titles and URLs that can help you find up-to-date information from the internet.

Important notes:
- If an MCP-provided web search tool is available, prefer using that tool instead, as it may have fewer restrictions
- You can optionally filter results by allowed or blocked domains
- You may provide either allowed_domains OR blocked_domains, but NOT both
- This tool is read-only and does not modify any files`

const QUERY_PARAMETER_DESCRIPTION = `The search query to use. Must be at least 2 characters.`

const ALLOWED_DOMAINS_PARAMETER_DESCRIPTION = `Optional array of domains to restrict results to. Only results from these domains will be returned. Cannot be used with blocked_domains.`

const BLOCKED_DOMAINS_PARAMETER_DESCRIPTION = `Optional array of domains to exclude from results. Results from these domains will be filtered out. Cannot be used with allowed_domains.`

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
				allowed_domains: {
					type: ["array", "null"],
					description: ALLOWED_DOMAINS_PARAMETER_DESCRIPTION,
					items: {
						type: "string",
					},
				},
				blocked_domains: {
					type: ["array", "null"],
					description: BLOCKED_DOMAINS_PARAMETER_DESCRIPTION,
					items: {
						type: "string",
					},
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
