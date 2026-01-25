import type { McpServerUse, McpServer, McpTool } from "@roo-code/types"

/**
 * Checks if a tool name matches a pattern (supports wildcard "*")
 * @param toolName The name of the tool to check
 * @param pattern The pattern to match against (can be "*" for wildcard)
 * @returns True if the tool name matches the pattern
 */
function matchesPattern(toolName: string, pattern: string): boolean {
	if (pattern === "*") {
		return true
	}
	return toolName === pattern
}

export function isMcpToolAlwaysAllowed(mcpServerUse: McpServerUse, mcpServers: McpServer[] | undefined): boolean {
	if (mcpServerUse.type === "use_mcp_tool" && mcpServerUse.toolName) {
		const server = mcpServers?.find((s: McpServer) => s.name === mcpServerUse.serverName)
		const tool = server?.tools?.find((t: McpTool) => t.name === mcpServerUse.toolName)
		return tool?.alwaysAllow || false
	}

	return false
}
