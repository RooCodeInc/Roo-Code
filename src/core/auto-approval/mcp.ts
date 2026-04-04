import type { McpServerUse, McpServer, McpTool } from "@jabberwock/types"
import { requiresUserInteraction } from "../../services/mcp/McpMigration"

export function isMcpToolAlwaysAllowed(mcpServerUse: McpServerUse, mcpServers: McpServer[] | undefined): boolean {
	if (mcpServerUse.type === "use_mcp_tool" && mcpServerUse.toolName) {
		const server = mcpServers?.find((s: McpServer) => s.name === mcpServerUse.serverName)

		// Jabberwock: Selective Auto-Approve
		if (server && server.config) {
			try {
				const config = JSON.parse(server.config)
				if (requiresUserInteraction(config) || config.autoApproveExcluded) {
					return false // Force human-in-the-loop
				}
			} catch (e) {
				// Ignore parsing errors
			}
		}

		const tool = server?.tools?.find((t: McpTool) => t.name === mcpServerUse.toolName)
		return tool?.alwaysAllow || false
	}

	return false
}
