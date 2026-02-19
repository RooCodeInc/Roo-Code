import { isMcpToolAlwaysAllowed } from "../mcp"
import type { McpServerUse, McpServer, McpTool } from "@roo-code/types"

function makeServerUse(serverName: string, toolName: string): McpServerUse {
	return { type: "use_mcp_tool", serverName, toolName }
}

function makeTool(name: string, alwaysAllow: boolean): McpTool {
	return { name, description: "test", inputSchema: {}, alwaysAllow } as McpTool
}

function makeServer(name: string, tools: McpTool[], config: string): McpServer {
	return { name, config, tools } as McpServer
}

describe("isMcpToolAlwaysAllowed", () => {
	describe("primary check: tool-level alwaysAllow flag", () => {
		it("returns true when tool has alwaysAllow set", () => {
			const server = makeServer("my-server", [makeTool("my-tool", true)], "{}")
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(true)
		})

		it("returns false when tool has alwaysAllow unset", () => {
			const server = makeServer("my-server", [makeTool("my-tool", false)], "{}")
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(false)
		})

		it("returns false when server not found", () => {
			expect(isMcpToolAlwaysAllowed(makeServerUse("missing-server", "my-tool"), [])).toBe(false)
		})

		it("returns false when mcpServers is undefined", () => {
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), undefined)).toBe(false)
		})

		it("returns false for non use_mcp_tool type", () => {
			const serverUse = { type: "access_mcp_resource", serverName: "s", toolName: "t" } as unknown as McpServerUse
			const server = makeServer("s", [makeTool("t", true)], "{}")
			expect(isMcpToolAlwaysAllowed(serverUse, [server])).toBe(false)
		})
	})

	describe("fallback: server config alwaysAllow", () => {
		it("returns true when tool missing alwaysAllow but server config has wildcard", () => {
			const config = JSON.stringify({ alwaysAllow: ["*"] })
			const server = makeServer("my-server", [makeTool("my-tool", false)], config)
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(true)
		})

		it("returns true when tool missing alwaysAllow but server config has tool name", () => {
			const config = JSON.stringify({ alwaysAllow: ["my-tool"] })
			const server = makeServer("my-server", [makeTool("my-tool", false)], config)
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(true)
		})

		it("returns false when tool missing alwaysAllow and config has different tools", () => {
			const config = JSON.stringify({ alwaysAllow: ["other-tool"] })
			const server = makeServer("my-server", [makeTool("my-tool", false)], config)
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(false)
		})

		it("returns false when config has empty alwaysAllow", () => {
			const config = JSON.stringify({ alwaysAllow: [] })
			const server = makeServer("my-server", [makeTool("my-tool", false)], config)
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(false)
		})

		it("returns false when config has no alwaysAllow field", () => {
			const config = JSON.stringify({ command: "node", args: ["server.js"] })
			const server = makeServer("my-server", [makeTool("my-tool", false)], config)
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(false)
		})

		it("returns false when config is invalid JSON", () => {
			const server = makeServer("my-server", [makeTool("my-tool", false)], "not-json")
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "my-tool"), [server])).toBe(false)
		})

		it("returns true with wildcard when tool is not in tools list at all", () => {
			const config = JSON.stringify({ alwaysAllow: ["*"] })
			const server = makeServer("my-server", [], config)
			expect(isMcpToolAlwaysAllowed(makeServerUse("my-server", "unlisted-tool"), [server])).toBe(true)
		})
	})
})
