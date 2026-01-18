export function getWebSearchDescription(): string {
	return `## web_search
Description: Search the public web for up-to-date information and return a concise list of results with titles, URLs, and snippets. Use this tool when you need real-time or external context that is not available in the local workspace.

Parameters:
- query: (required) The search query to run.
- max_results: (optional) Maximum number of results to return (default: 5, max: 10).

Usage:
<web_search>
<query>Your search query</query>
<max_results>5</max_results>
</web_search>

Example:
<web_search>
<query>OpenAI Responses API web search tool</query>
<max_results>3</max_results>
</web_search>`
}
