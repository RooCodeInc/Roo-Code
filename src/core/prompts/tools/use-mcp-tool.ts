import { ToolArgs } from "./types"

export function getUseMcpToolDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}
	return `## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.

**IMPORTANT**: You MUST always use the \`use_mcp_tool\` wrapper format shown below. Do NOT call MCP tools directly by their tool name.

Parameters:
- server_name: (required) The name of the MCP server providing the tool
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema

Correct Usage Format:
<use_mcp_tool>
<server_name>server name here</server_name>
<tool_name>tool name here</tool_name>
<arguments>
{
	 "param1": "value1",
	 "param2": "value2"
}
</arguments>
</use_mcp_tool>

❌ INCORRECT - Do NOT use this format:
<get_pull_request>
<owner>username</owner>
<repo>repository</repo>
<pullNumber>123</pullNumber>
</get_pull_request>

✅ CORRECT - Always use this format:
<use_mcp_tool>
<server_name>github</server_name>
<tool_name>get_pull_request</tool_name>
<arguments>
{
	 "owner": "username",
	 "repo": "repository",
	 "pullNumber": 123
}
</arguments>
</use_mcp_tool>

Example: Using a weather MCP tool

<use_mcp_tool>
<server_name>weather-server</server_name>
<tool_name>get_forecast</tool_name>
<arguments>
{
	 "city": "San Francisco",
	 "days": 5
}
</arguments>
</use_mcp_tool>

Remember: ALWAYS wrap MCP tool calls in the \`use_mcp_tool\` format, never call them directly by their tool name.`
}
