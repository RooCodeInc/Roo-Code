export function getWebSearchDescription(): string {
	return `## web_search
Description: Request to perform a web search and retrieve relevant information from the internet. This tool allows you to search for current information, documentation, tutorials, and other web content that may be helpful for completing tasks. Use this when you need up-to-date information that may not be in your training data.
Parameters:
- query: (required) The search query string. Be specific and include relevant keywords for better results.
Usage:
<web_search>
<query>Your search query here</query>
</web_search>

Example: Searching for Chrome extension development documentation
<web_search>
<query>Chrome extension development manifest v3 documentation</query>
</web_search>

Example: Searching for a specific error message
<web_search>
<query>"TypeError: Cannot read property" React hooks solution</query>
</web_search>

Example: Searching for current library versions or updates
<web_search>
<query>latest React 18 features and breaking changes</query>
</web_search>

Note: This tool performs a web search and returns summarized results. The quality of results depends on the specificity of your query. Use quotation marks for exact phrase matching and include relevant context for better results.`
}
