import type OpenAI from "openai"
import type { ModeConfig } from "@roo-code/types"

import { filterMcpToolsForMode } from "../../../../core/prompts/tools/filter-tools-for-mode"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMcpTool(serverName: string, toolName: string): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: "mcp--" + serverName + "--" + toolName,
			description: serverName + " / " + toolName,
			parameters: { type: "object", properties: {} },
		},
	}
}

function makeNativeTool(name: string): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name: name,
			description: "native tool " + name,
			parameters: { type: "object", properties: {} },
		},
	}
}

// A mode with 'mcp' group and NO filtering config (plain string)
const modeNoFilter: ModeConfig = {
	slug: "mode-no-filter",
	name: "No Filter Mode",
	roleDefinition: "test role",
	groups: ["read", "mcp"],
}

// A mode with 'mcp' group and a disabled server
const modeServerDisabled: ModeConfig = {
	slug: "mode-server-disabled",
	name: "Server Disabled Mode",
	roleDefinition: "test role",
	groups: [
		"read",
		[
			"mcp",
			{
				mcpServers: {
					"weather-server": { disabled: true },
				},
			},
		],
	],
}

// A mode with 'mcp' group and a tool in disabledTools
const modeToolDisabled: ModeConfig = {
	slug: "mode-tool-disabled",
	name: "Tool Disabled Mode",
	roleDefinition: "test role",
	groups: [
		"read",
		[
			"mcp",
			{
				mcpServers: {
					"weather-server": {
						disabled: false,
						disabledTools: ["get_forecast"],
					},
				},
			},
		],
	],
}

// A mode with 'mcp' group and allowedTools whitelist
const modeAllowedTools: ModeConfig = {
	slug: "mode-allowed-tools",
	name: "Allowed Tools Mode",
	roleDefinition: "test role",
	groups: [
		"read",
		[
			"mcp",
			{
				mcpServers: {
					"weather-server": {
						disabled: false,
						allowedTools: ["get_forecast"],
					},
				},
			},
		],
	],
}

// A mode with mcpDefaultPolicy = 'deny'
const modeDenyPolicy: ModeConfig = {
	slug: "mode-deny-policy",
	name: "Deny Policy Mode",
	roleDefinition: "test role",
	groups: [
		"read",
		[
			"mcp",
			{
				mcpDefaultPolicy: "deny",
				mcpServers: {
					"weather-server": { disabled: false },
				},
			},
		],
	],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("filterMcpToolsForMode - per-server/tool MCP filtering", () => {
	const weatherTool1 = makeMcpTool("weather-server", "get_forecast")
	const weatherTool2 = makeMcpTool("weather-server", "get_alerts")
	const dbTool = makeMcpTool("db-server", "query")
	const experiments = {}

	it("passes all MCP tools when mode has no MCP filtering config", () => {
		const tools = [weatherTool1, weatherTool2, dbTool]
		const result = filterMcpToolsForMode(tools, "mode-no-filter", [modeNoFilter], experiments)
		expect(result).toHaveLength(3)
	})

	it("excludes tools from a disabled server", () => {
		const tools = [weatherTool1, weatherTool2, dbTool]
		const result = filterMcpToolsForMode(tools, "mode-server-disabled", [modeServerDisabled], experiments)
		// weather-server disabled, only db-server tool remains
		expect(result).toHaveLength(1)
		expect((result[0] as any).function.name).toBe("mcp--db-server--query")
	})

	it("excludes a tool that is in disabledTools", () => {
		const tools = [weatherTool1, weatherTool2, dbTool]
		const result = filterMcpToolsForMode(tools, "mode-tool-disabled", [modeToolDisabled], experiments)
		// get_forecast disabled, get_alerts and db query remain
		expect(result).toHaveLength(2)
		const names = result.map((t: any) => t.function.name)
		expect(names).toContain("mcp--weather-server--get_alerts")
		expect(names).toContain("mcp--db-server--query")
		expect(names).not.toContain("mcp--weather-server--get_forecast")
	})

	it("only allows tools in allowedTools whitelist", () => {
		const tools = [weatherTool1, weatherTool2, dbTool]
		const result = filterMcpToolsForMode(tools, "mode-allowed-tools", [modeAllowedTools], experiments)
		// Only get_forecast from weather-server + db-server (no filter on db)
		expect(result).toHaveLength(2)
		const names = result.map((t: any) => t.function.name)
		expect(names).toContain("mcp--weather-server--get_forecast")
		expect(names).toContain("mcp--db-server--query")
		expect(names).not.toContain("mcp--weather-server--get_alerts")
	})

	it("excludes unlisted servers when mcpDefaultPolicy is deny", () => {
		const tools = [weatherTool1, dbTool]
		const result = filterMcpToolsForMode(tools, "mode-deny-policy", [modeDenyPolicy], experiments)
		// weather-server listed (not disabled), db-server not listed + deny policy
		expect(result).toHaveLength(1)
		expect((result[0] as any).function.name).toBe("mcp--weather-server--get_forecast")
	})

	it("does not affect non-MCP tools (passthrough)", () => {
		const nativeTool = makeNativeTool("read_file")
		// filterMcpToolsForMode receives only MCP tools in practice,
		// but if a non-MCP tool sneaks in, it should be preserved.
		const tools = [nativeTool, weatherTool1]
		const result = filterMcpToolsForMode(tools, "mode-server-disabled", [modeServerDisabled], experiments)
		// native tool passes through, weather-server disabled
		const names = result.map((t: any) => t.function.name)
		expect(names).toContain("read_file")
		expect(names).not.toContain("mcp--weather-server--get_forecast")
	})
})
