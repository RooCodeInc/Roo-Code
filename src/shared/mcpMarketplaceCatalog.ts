/**
 * Pre-configured MCP server templates for one-click installation from the MCP Marketplace.
 * Each entry defines a server configuration that can be written to the user's MCP settings file.
 */

export interface McpMarketplaceItem {
	/** Unique key used as the server name in mcpServers config */
	name: string
	/** Human-readable display name */
	displayName: string
	/** Short description of what the server does */
	description: string
	/** Category tag for grouping */
	category: "search" | "tools" | "data"
	/** The MCP server configuration to write */
	config: {
		command: string
		args: string[]
		env?: Record<string, string>
		alwaysAllow?: string[]
	}
	/** Whether the server requires user-provided env variables before installation */
	requiresSetup?: boolean
	/** Keys in env that need user customization (e.g. instance URLs) */
	setupEnvKeys?: string[]
	/** URL for more info / docs */
	url?: string
}

export const mcpMarketplaceCatalog: McpMarketplaceItem[] = [
	{
		name: "ddg-search",
		displayName: "DuckDuckGo Search",
		description: "Free web search via DuckDuckGo. No API key required.",
		category: "search",
		config: {
			command: "uvx",
			args: ["duckduckgo-mcp-server"],
			env: {
				DDG_SAFE_SEARCH: "OFF",
				DDG_REGION: "wt-wt",
			},
			alwaysAllow: ["search", "fetch_content"],
		},
		url: "https://pypi.org/project/duckduckgo-mcp-server/",
	},
	{
		name: "searxng",
		displayName: "SearXNG",
		description: "Privacy-focused metasearch engine. Requires a self-hosted SearXNG instance URL.",
		category: "search",
		config: {
			command: "npx",
			args: ["-y", "mcp-searxng"],
			env: {
				SEARXNG_URL: "https://searxng.example.com",
			},
			alwaysAllow: ["searxng_web_search", "web_url_read"],
		},
		requiresSetup: true,
		setupEnvKeys: ["SEARXNG_URL"],
		url: "https://www.npmjs.com/package/mcp-searxng",
	},
	{
		name: "web-search",
		displayName: "Web Search (DuckDuckGo)",
		description: "Lightweight web search via DuckDuckGo. No API key required. Uses npx.",
		category: "search",
		config: {
			command: "npx",
			args: ["-y", "github:tiagohanna123/web-search-mcp"],
			alwaysAllow: [],
		},
		url: "https://github.com/tiagohanna123/web-search-mcp",
	},
]
