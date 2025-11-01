import type { ToolSpec } from "../../../api/transform/tool-converters"

/**
 * Tool specification for use_mcp_tool
 * This defines the schema for using MCP server tools
 */
export const useMcpToolToolSpec: ToolSpec = {
	name: "use_mcp_tool",
	description:
		"Request to use a tool provided by an MCP (Model Context Protocol) server. MCP servers extend Roo's capabilities with custom tools. This tool acts as a bridge to execute MCP server tools.",
	parameters: [
		{
			name: "server_name",
			type: "string",
			required: true,
			description: "The name of the MCP server that provides the tool",
		},
		{
			name: "tool_name",
			type: "string",
			required: true,
			description: "The name of the tool to execute on the MCP server",
		},
		{
			name: "arguments",
			type: "string",
			required: true,
			description: "JSON string of arguments to pass to the MCP tool",
		},
	],
}
