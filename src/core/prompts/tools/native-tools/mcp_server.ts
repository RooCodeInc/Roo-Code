import type OpenAI from "openai"
import { McpHub } from "../../../../services/mcp/McpHub"
import { McpToolRegistry } from "../../../../services/mcp/McpToolRegistry"

/**
 * Dynamically generates native tool definitions for all enabled tools across connected MCP servers.
 *
 * @param mcpHub The McpHub instance containing connected servers.
 * @returns An array of OpenAI.Chat.ChatCompletionTool definitions.
 */
export function getMcpServerTools(mcpHub?: McpHub): OpenAI.Chat.ChatCompletionTool[] {
	if (!mcpHub) {
		return []
	}

	const servers = mcpHub.getServers()
	const tools: OpenAI.Chat.ChatCompletionTool[] = []

	for (const server of servers) {
		if (!server.tools) {
			continue
		}
		for (const tool of server.tools) {
			// Filter tools where tool.enabledForPrompt is not explicitly false
			if (tool.enabledForPrompt === false) {
				continue
			}

			const originalSchema = tool.inputSchema as Record<string, any> | undefined
			const toolInputProps = originalSchema?.properties ?? {}
			const toolInputRequired = (originalSchema?.required ?? []) as string[]

			// Build parameters directly from the tool's input schema.
			// The server_name and tool_name are registered in McpToolRegistry,
			// which returns an API-compatible name (e.g., mcp_0, mcp_1).
			const parameters: OpenAI.FunctionParameters = {
				type: "object",
				properties: toolInputProps,
				additionalProperties: false,
			}

			// Only add required if there are required fields
			if (toolInputRequired.length > 0) {
				parameters.required = toolInputRequired
			}

			// Register tool in McpToolRegistry to get an API-compatible name.
			// This avoids issues with dots in MCP tool names (e.g., "agent.describe")
			// which violate Bedrock's [a-zA-Z0-9_-]+ constraint.
			const toolDefinition: OpenAI.Chat.ChatCompletionTool = {
				type: "function",
				function: {
					name: McpToolRegistry.register(server.name, tool.name),
					description: tool.description,
					parameters: parameters,
				},
			}

			tools.push(toolDefinition)
		}
	}

	return tools
}
