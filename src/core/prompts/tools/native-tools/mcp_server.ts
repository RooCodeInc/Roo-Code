import type OpenAI from "openai"
import { McpHub } from "../../../../services/mcp/McpHub"

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
			const toolInputPropsRaw = originalSchema?.properties ?? {}
			const toolInputRequired = (originalSchema?.required ?? []) as string[]

			// Handle reserved property names like 'type'
			const sanitizedToolInputProps: Record<string, any> = {}
			const sanitizedRequired: string[] = []

			for (const [propName, propValue] of Object.entries(toolInputPropsRaw)) {
				// rename 'type' to 'renamed_type' because 'type' is a reserved word in JSON Schema
				// for many parsers.
				if (propName === "type") {
					sanitizedToolInputProps[`renamed_${propName}`] = propValue
					// Update required array if 'type' was required
					if (toolInputRequired.includes(propName)) {
						sanitizedRequired.push(`renamed_${propName}`)
					}
				} else {
					sanitizedToolInputProps[propName] = propValue
					if (toolInputRequired.includes(propName)) {
						sanitizedRequired.push(propName)
					}
				}
			}

			// Create a proper JSON Schema object for toolInputProps
			const toolInputPropsSchema: Record<string, any> = {
				type: "object",
				properties: sanitizedToolInputProps,
				additionalProperties: false,
			}

			// Only add required if there are required fields
			if (sanitizedRequired.length > 0) {
				toolInputPropsSchema.required = sanitizedRequired
			}

			// Build parameters with all properties defined before adding required array
			const parameters = {
				type: "object",
				properties: {
					toolInputProps: toolInputPropsSchema,
					server_name: {
						type: "string",
						const: server.name,
					},
					tool_name: {
						type: "string",
						const: tool.name,
					},
				},
				required: ["server_name", "tool_name", "toolInputProps"],
				additionalProperties: false,
			} as OpenAI.FunctionParameters

			// The description matches what the MCP server provides as guidance.
			// Use triple underscores as separator to allow underscores in tool names
			const toolDefinition: OpenAI.Chat.ChatCompletionTool = {
				type: "function",
				function: {
					name: `use_mcp_tool___${server.name}___${tool.name}`,
					description: tool.description,
					parameters: parameters,
				},
			}

			tools.push(toolDefinition)
		}
	}

	return tools
}
