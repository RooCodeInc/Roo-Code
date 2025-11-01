import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for access_mcp_resource
 * This defines the schema for accessing MCP server resources
 */
export const accessMcpResourceToolSpec: ToolSpec = {
	name: "access_mcp_resource",
	description:
		"Request to access a resource provided by an MCP (Model Context Protocol) server. MCP servers can provide various resources like file systems, databases, or APIs. This tool acts as a bridge to access MCP server resources.",
	parameters: [
		{
			name: "server_name",
			type: "string",
			required: true,
			description: "The name of the MCP server that provides the resource",
		},
		{
			name: "uri",
			type: "string",
			required: true,
			description: "The URI of the resource to access on the MCP server",
		},
	],
}
