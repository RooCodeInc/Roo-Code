import type OpenAI from "openai"
import { McpHub } from "../../../../services/mcp/McpHub"
import { buildMcpToolName } from "../../../../utils/mcp-name"

/**
 * Recursively adds `additionalProperties: false` to all object types in a JSON schema.
 * This is required for OpenAI's strict mode function calling.
 *
 * @param schema The schema object to process
 * @returns A new schema with additionalProperties: false added to all object types
 */
export function addAdditionalPropertiesToSchema(schema: Record<string, any>): Record<string, any> {
	if (!schema || typeof schema !== "object") {
		return schema
	}

	const result: Record<string, any> = { ...schema }

	// If this is an object type with properties, add additionalProperties: false
	if (result.type === "object" && result.properties) {
		result.additionalProperties = false
		// Recursively process each property
		const newProperties: Record<string, any> = {}
		for (const [key, value] of Object.entries(result.properties)) {
			newProperties[key] = addAdditionalPropertiesToSchema(value as Record<string, any>)
		}
		result.properties = newProperties
	}

	// Handle array items
	if (result.items) {
		if (Array.isArray(result.items)) {
			result.items = result.items.map((item: Record<string, any>) => addAdditionalPropertiesToSchema(item))
		} else {
			result.items = addAdditionalPropertiesToSchema(result.items)
		}
	}

	// Handle combinators (anyOf, allOf, oneOf)
	for (const combinator of ["anyOf", "allOf", "oneOf"]) {
		if (Array.isArray(result[combinator])) {
			result[combinator] = result[combinator].map((subSchema: Record<string, any>) =>
				addAdditionalPropertiesToSchema(subSchema),
			)
		}
	}

	// Handle conditional schemas
	if (result.if) {
		result.if = addAdditionalPropertiesToSchema(result.if)
	}
	if (result.then) {
		result.then = addAdditionalPropertiesToSchema(result.then)
	}
	if (result.else) {
		result.else = addAdditionalPropertiesToSchema(result.else)
	}

	// Handle definitions/defs
	if (result.definitions) {
		const newDefinitions: Record<string, any> = {}
		for (const [key, value] of Object.entries(result.definitions)) {
			newDefinitions[key] = addAdditionalPropertiesToSchema(value as Record<string, any>)
		}
		result.definitions = newDefinitions
	}
	if (result.$defs) {
		const newDefs: Record<string, any> = {}
		for (const [key, value] of Object.entries(result.$defs)) {
			newDefs[key] = addAdditionalPropertiesToSchema(value as Record<string, any>)
		}
		result.$defs = newDefs
	}

	return result
}

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
			const toolInputRequired = (originalSchema?.required ?? []) as string[]

			// Process the properties through the schema transformer to ensure all nested
			// object types have additionalProperties: false (required for OpenAI strict mode)
			const originalProps = originalSchema?.properties ?? {}
			const processedProps: Record<string, any> = {}
			for (const [key, value] of Object.entries(originalProps)) {
				processedProps[key] = addAdditionalPropertiesToSchema(value as Record<string, any>)
			}

			// Build parameters directly from the tool's input schema.
			// The server_name and tool_name are encoded in the function name itself
			// (e.g., mcp_serverName_toolName), so they don't need to be in the arguments.
			const parameters: OpenAI.FunctionParameters = {
				type: "object",
				properties: processedProps,
				additionalProperties: false,
			}

			// Only add required if there are required fields
			if (toolInputRequired.length > 0) {
				parameters.required = toolInputRequired
			}

			// Build sanitized tool name for API compliance
			// The name is sanitized to conform to API requirements (e.g., Gemini's function name restrictions)
			const toolName = buildMcpToolName(server.name, tool.name)

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
