import type OpenAI from "openai"

const USE_MCP_TOOL_DESCRIPTION = `Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.

Parameters:
- server_name: (required) The name of the MCP server that provides the tool
- tool_name: (required) The name of the tool to use from the specified server
- arguments: (optional) The arguments to pass to the tool, as a JSON object matching the tool's input schema

Example: Using a weather tool
{ "server_name": "weather-server", "tool_name": "get-forecast", "arguments": { "city": "San Francisco", "days": 5 } }`

const SERVER_NAME_PARAMETER_DESCRIPTION = `The name of the MCP server that provides the tool`

const TOOL_NAME_PARAMETER_DESCRIPTION = `The name of the tool to use from the specified server`

const ARGUMENTS_PARAMETER_DESCRIPTION = `The arguments to pass to the tool, as a JSON object matching the tool's input schema`

export default {
	type: "function",
	function: {
		name: "use_mcp_tool",
		description: USE_MCP_TOOL_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				server_name: {
					type: "string",
					description: SERVER_NAME_PARAMETER_DESCRIPTION,
				},
				tool_name: {
					type: "string",
					description: TOOL_NAME_PARAMETER_DESCRIPTION,
				},
				arguments: {
					type: ["object", "null"],
					description: ARGUMENTS_PARAMETER_DESCRIPTION,
				},
			},
			required: ["server_name", "tool_name", "arguments"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
