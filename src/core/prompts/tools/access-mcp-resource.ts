import { ToolArgs } from "./types"
import { McpHub } from "../../../services/mcp/McpHub"

/**
 * Helper function to check if any MCP server has resources available
 */
function hasAnyMcpResources(mcpHub: McpHub): boolean {
	const servers = mcpHub.getServers()
	return servers.some((server) => server.resources && server.resources.length > 0)
}

export function getAccessMcpResourceDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub || !hasAnyMcpResources(args.mcpHub)) {
		return undefined
	}
	return `## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.
Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access
Usage (native tool calling):
Call the tool with structured arguments.

Example:
- server_name: weather-server
- uri: weather://san-francisco/current`
}
