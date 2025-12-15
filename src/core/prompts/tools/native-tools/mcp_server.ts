import type OpenAI from "openai"
import { McpHub } from "../../../../services/mcp/McpHub"
import { buildMcpToolName } from "../../../../utils/mcp-name"
import { addAdditionalPropertiesFalse } from "../../../../utils/json-schema"

/**
 * Dynamically generates native tool definitions for all enabled tools across connected MCP servers.
 * Tools are deduplicated by name to prevent API errors. When the same server exists in both
 * global and project configs, project servers take priority (handled by McpHub.getServers()).
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
	// Track seen tool names to prevent duplicates (e.g., when same server exists in both global and project configs)
	const seenToolNames = new Set<string>()

	for (const server of servers) {
		if (!server.tools) {
			continue
		}
		for (const tool of server.tools) {
			// Filter tools where tool.enabledForPrompt is not explicitly false
			if (tool.enabledForPrompt === false) {
				continue
			}

			// Build sanitized tool name for API compliance
			// The name is sanitized to conform to API requirements (e.g., Gemini's function name restrictions)
			const toolName = buildMcpToolName(server.name, tool.name)

			// Skip duplicate tool names - first occurrence wins (project servers come before global servers)
			if (seenToolNames.has(toolName)) {
				continue
			}
			seenToolNames.add(toolName)

			const originalSchema = tool.inputSchema as Record<string, any> | undefined
			const toolInputRequired = (originalSchema?.required ?? []) as string[]

			// Transform the schema to ensure all nested object schemas have additionalProperties: false
			// This is required by some API providers (e.g., OpenAI) for strict function calling
			const transformedSchema = originalSchema ? addAdditionalPropertiesFalse(originalSchema) : {}
			const toolInputProps = (transformedSchema as Record<string, any>)?.properties ?? {}

			// Build parameters directly from the tool's input schema.
			// The server_name and tool_name are encoded in the function name itself
			// (e.g., mcp_serverName_toolName), so they don't need to be in the arguments.
			const parameters: OpenAI.FunctionParameters = {
				type: "object",
				properties: toolInputProps,
				additionalProperties: false,
			}

			// Only add required if there are required fields
			if (toolInputRequired.length > 0) {
				parameters.required = toolInputRequired
			}

			const toolDefinition: OpenAI.Chat.ChatCompletionTool = {
				type: "function",
				function: {
					name: toolName,
					description: tool.description,
					parameters: parameters,
				},
			}

			tools.push(toolDefinition)
		}
	}

	return tools
}
