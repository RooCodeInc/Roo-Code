import type { McpTool } from "@roo-code/types"

import { McpHub } from "../../../services/mcp/McpHub"
import { buildMcpToolName } from "../../../utils/mcp-name"

/**
 * Generates a lightweight MCP servers section for the system prompt.
 *
 * This provides the model with context about connected MCP servers, including:
 * - The naming convention for MCP tool calls (mcp--serverName--toolName)
 * - A list of connected servers and their available tools
 * - Server-specific instructions (from the MCP protocol's `instructions` field)
 *
 * This does NOT duplicate tool schemas or descriptions, since those are already
 * provided via native tool definitions. The purpose is to give the model enough
 * context to understand how to use these tools, which is especially important
 * for models like OpenAI's GPT series that benefit from explicit system prompt
 * guidance about available MCP tools.
 */
export function getMcpServersSection(mcpHub?: McpHub): string {
	if (!mcpHub) {
		return ""
	}

	const servers = mcpHub.getServers()

	if (servers.length === 0) {
		return ""
	}

	// Build per-server entries with tool names and optional instructions
	const serverEntries: string[] = []

	for (const server of servers) {
		const enabledTools = (server.tools || []).filter((tool: McpTool) => tool.enabledForPrompt !== false)

		if (enabledTools.length === 0) {
			continue
		}

		const toolNames = enabledTools.map((tool: McpTool) => `  - ${buildMcpToolName(server.name, tool.name)}`)

		let entry = `## ${server.name}\n`
		entry += `Tools:\n${toolNames.join("\n")}`

		if (server.instructions) {
			entry += `\n\nServer Instructions:\n${server.instructions}`
		}

		serverEntries.push(entry)
	}

	if (serverEntries.length === 0) {
		return ""
	}

	return `====

MCP SERVERS

The following MCP (Model Context Protocol) servers are connected and provide additional tools you can use. MCP tools are called as native tool calls using the naming convention \`mcp--serverName--toolName\`. When a task could benefit from an MCP tool, prefer using it.

${serverEntries.join("\n\n")}`
}
