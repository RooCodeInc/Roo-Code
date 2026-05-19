import type OpenAI from "openai"
import type { McpHub } from "../../../../services/mcp/McpHub"

const BASE_DESCRIPTION = `Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.

Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access`

const SERVER_NAME_PARAMETER_DESCRIPTION = `The name of the MCP server providing the resource`

const URI_PARAMETER_DESCRIPTION = `The URI identifying the specific resource to access`

/**
 * Builds a dynamic description for the access_mcp_resource tool that includes
 * available resources and resource templates from connected MCP servers.
 * This gives the model the information it needs to construct valid resource URIs.
 */
function buildDescription(mcpHub?: McpHub): string {
	if (!mcpHub) {
		return BASE_DESCRIPTION
	}

	const servers = mcpHub.getServers()
	const serverSections: string[] = []

	for (const server of servers) {
		const resourceLines: string[] = []

		if (server.resources && server.resources.length > 0) {
			for (const resource of server.resources) {
				let line = `  - ${resource.uri}`
				if (resource.name) {
					line += ` (${resource.name})`
				}
				if (resource.description) {
					line += `: ${resource.description}`
				}
				resourceLines.push(line)
			}
		}

		if (server.resourceTemplates && server.resourceTemplates.length > 0) {
			for (const template of server.resourceTemplates) {
				let line = `  - ${template.uriTemplate}`
				if (template.name) {
					line += ` (${template.name})`
				}
				if (template.description) {
					line += `: ${template.description}`
				}
				resourceLines.push(line)
			}
		}

		if (resourceLines.length > 0) {
			serverSections.push(`\nServer "${server.name}" resources:\n${resourceLines.join("\n")}`)
		}
	}

	if (serverSections.length === 0) {
		return BASE_DESCRIPTION
	}

	return `${BASE_DESCRIPTION}

Available MCP Resources:
${serverSections.join("\n")}`
}

/**
 * Creates the access_mcp_resource tool definition with a dynamic description
 * that includes available resources from connected MCP servers.
 */
export function createAccessMcpResourceTool(mcpHub?: McpHub): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: "access_mcp_resource",
			description: buildDescription(mcpHub),
			strict: true,
			parameters: {
				type: "object",
				properties: {
					server_name: {
						type: "string",
						description: SERVER_NAME_PARAMETER_DESCRIPTION,
					},
					uri: {
						type: "string",
						description: URI_PARAMETER_DESCRIPTION,
					},
				},
				required: ["server_name", "uri"],
				additionalProperties: false,
			},
		},
	}
}

// Default export for backward compatibility (static definition without resource info)
export default createAccessMcpResourceTool()
