import { McpHub } from "../../../services/mcp/McpHub"
import { buildMcpToolName } from "../../../utils/mcp-name"

/**
 * Generates a lightweight MCP servers section for the system prompt.
 *
 * This section provides the model with context about connected MCP servers,
 * their tool name mappings, and any server-specific instructions. It does NOT
 * duplicate tool schemas (those are already provided via native tool definitions).
 *
 * This context is particularly important for models like OpenAI's GPT series,
 * which need explicit guidance to understand the mcp--serverName--toolName
 * naming convention used by native tool definitions.
 */
export function getMcpServersSection(mcpHub?: McpHub): string {
	if (!mcpHub) {
		return ""
	}

	const servers = mcpHub.getServers()
	const connectedServers = servers.filter((server) => server.status === "connected")

	if (connectedServers.length === 0) {
		return ""
	}

	const serverSections: string[] = []

	for (const server of connectedServers) {
		const toolLines: string[] = []

		if (server.tools) {
			for (const tool of server.tools) {
				if (tool.enabledForPrompt === false) {
					continue
				}
				toolLines.push(`  - ${buildMcpToolName(server.name, tool.name)}`)
			}
		}

		const toolList = toolLines.length > 0 ? toolLines.join("\n") : "  (No tools available)"
		const instructionsBlock = server.instructions ? `\nInstructions: ${server.instructions}` : ""

		serverSections.push(`## ${server.name}${instructionsBlock}\nTools:\n${toolList}`)
	}

	return `====

MCP SERVERS

MCP servers provide additional tools beyond the built-in set. Tools from MCP servers are called using the naming convention \`mcp--serverName--toolName\` (e.g., \`mcp--git--git_log\`). These tools are available as callable functions alongside the built-in tools. When a task could benefit from an MCP server's capabilities, prefer using the appropriate MCP tool.

# Connected MCP Servers

${serverSections.join("\n\n")}`
}
