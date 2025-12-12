/**
 * Registry for mapping MCP tool names to API-compatible identifiers.
 *
 * Problem: AWS Bedrock (and potentially other providers) only accept tool names
 * matching [a-zA-Z0-9_-]+, but MCP tools can have dots in their names
 * (e.g., "agent-block.describe", "debug.state.get_full").
 *
 * Solution: This registry assigns simple numeric identifiers (mcp_0, mcp_1, etc.)
 * to each unique server+tool combination, allowing bidirectional lookup.
 *
 * Lifecycle: The registry should be cleared at the start of each API request,
 * as tools are re-registered when building the prompt. This is safe because
 * the response parsing happens in the same request cycle.
 *
 * Performance: All operations are O(1) Map lookups - no string manipulation.
 */

export interface McpToolEntry {
	serverName: string
	toolName: string
}

/**
 * Static registry for MCP tool name mapping.
 * Use register() when building tools, lookup() when parsing responses.
 */
export class McpToolRegistry {
	/** Maps API name (e.g., "mcp_0") to original server/tool names */
	private static registry = new Map<string, McpToolEntry>()

	/** Maps "serverName:toolName" to API name for idempotent registration */
	private static reverseIndex = new Map<string, string>()

	/** Counter for generating unique API names */
	private static nextId = 0

	/**
	 * Register an MCP tool and get back an API-compatible name.
	 * Idempotent: returns existing name if already registered.
	 *
	 * @param serverName - The MCP server name
	 * @param toolName - The MCP tool name (may contain dots)
	 * @returns API-compatible name (e.g., "mcp_0")
	 */
	public static register(serverName: string, toolName: string): string {
		const key = `${serverName}:${toolName}`

		// Return existing if already registered
		const existing = this.reverseIndex.get(key)
		if (existing) {
			return existing
		}

		// Create new API-compatible name
		const apiName = `mcp_${this.nextId++}`

		this.registry.set(apiName, { serverName, toolName })
		this.reverseIndex.set(key, apiName)

		return apiName
	}

	/**
	 * Look up the original server/tool names from an API name.
	 *
	 * @param apiName - The API name (e.g., "mcp_0")
	 * @returns The original entry, or undefined if not found
	 */
	public static lookup(apiName: string): McpToolEntry | undefined {
		return this.registry.get(apiName)
	}

	/**
	 * Check if an API name is a registered MCP tool.
	 *
	 * @param apiName - The name to check
	 * @returns true if this is a registered MCP tool
	 */
	public static isRegistered(apiName: string): boolean {
		return this.registry.has(apiName)
	}

	/**
	 * Clear all registrations.
	 * Should be called at the start of each API request to prevent stale mappings.
	 */
	public static clear(): void {
		this.registry.clear()
		this.reverseIndex.clear()
		this.nextId = 0
	}

	/**
	 * Get the number of registered tools.
	 * Useful for debugging and testing.
	 */
	public static size(): number {
		return this.registry.size
	}

	/**
	 * Get all registered entries for debugging.
	 * Returns a shallow copy to prevent external mutation.
	 */
	public static getAll(): Map<string, McpToolEntry> {
		return new Map(this.registry)
	}
}
