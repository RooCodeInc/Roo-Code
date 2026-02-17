import type { McpServerUse, McpServer, McpTool } from "@roo-code/types"

import { toolNamesMatch } from "../../utils/mcp-name"

export function isMcpToolAlwaysAllowed(mcpServerUse: McpServerUse, mcpServers: McpServer[] | undefined): boolean {
	if (mcpServerUse.type === "use_mcp_tool" && mcpServerUse.toolName) {
		const wantedServer = String(mcpServerUse.serverName || "").toLowerCase()
		const wantedTool = String(mcpServerUse.toolName || "")

		const server = mcpServers?.find((s: McpServer) => String(s.name || "").toLowerCase() === wantedServer)
		const tool = server?.tools?.find((t: McpTool) => toolNamesMatch(String(t.name || ""), wantedTool))
		return tool?.alwaysAllow || false
	}

	return false
}
