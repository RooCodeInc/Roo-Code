import type OpenAI from "openai"
import { McpHub } from "../../../../services/mcp/McpHub"

/**
 * Dynamically generates native tool definitions for all enabled tools across connected MCP servers.
 *
 * NOTE: When native tool calling is enabled, MCP tools are handled through the single
 * `use_mcp_tool` native tool definition instead of individual tool definitions.
 * This function now returns an empty array as MCP tools are accessed via use_mcp_tool.
 *
 * @param mcpHub The McpHub instance containing connected servers.
 * @returns An empty array (MCP tools are handled via use_mcp_tool in native mode).
 */
export function getMcpServerTools(mcpHub?: McpHub): OpenAI.Chat.ChatCompletionTool[] {
	// When using native tool calling, MCP tools are accessed through the single
	// use_mcp_tool native tool definition, not as individual tool definitions.
	// This prevents models from trying to call MCP tools with incorrect formats.
	return []
}
