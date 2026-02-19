import type { McpServerUse, McpServer, McpTool } from "@roo-code/types"

export function isMcpToolAlwaysAllowed(mcpServerUse: McpServerUse, mcpServers: McpServer[] | undefined): boolean {
	if (mcpServerUse.type === "use_mcp_tool" && mcpServerUse.toolName) {
		const server = mcpServers?.find((s: McpServer) => s.name === mcpServerUse.serverName)
		if (!server) return false

		// Primary check: tool-level flag set by fetchToolsList()
		const tool = server.tools?.find((t: McpTool) => t.name === mcpServerUse.toolName)
		if (tool?.alwaysAllow) return true

		// Fallback: check the server's stored config directly.
		// server.config is the JSON-stringified validated config set at connection
		// creation time. It includes the alwaysAllow array from mcp_settings.json.
		// This handles race conditions where fetchToolsList() hasn't completed or
		// its config file read failed silently.
		try {
			const config = JSON.parse(server.config)
			const alwaysAllowConfig: string[] = config.alwaysAllow || []
			return alwaysAllowConfig.includes("*") || alwaysAllowConfig.includes(mcpServerUse.toolName)
		} catch {
			return false
		}
	}

	return false
}
