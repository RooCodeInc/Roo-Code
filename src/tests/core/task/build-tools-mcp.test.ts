import type OpenAI from "openai"
import type { ModeConfig, McpServer, McpTool } from "@roo-code/types"

import type { McpHub } from "../../../services/mcp/McpHub"

// ---------------------------------------------------------------------------
// Mock setup — must be before imports that trigger module resolution
// ---------------------------------------------------------------------------

// Mock vscode
vi.mock("vscode", () => ({}))

// Mock CodeIndexManager
vi.mock("../../../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn().mockReturnValue(undefined),
	},
}))

// Mock customToolRegistry
vi.mock("@roo-code/core", () => ({
	customToolRegistry: {
		loadFromDirectoriesIfStale: vi.fn().mockResolvedValue(undefined),
		getAllSerialized: vi.fn().mockReturnValue([]),
	},
	formatNative: vi.fn(),
}))

// Mock getRooDirectoriesForCwd
vi.mock("../../../services/roo-config/index.js", () => ({
	getRooDirectoriesForCwd: vi.fn().mockReturnValue([]),
}))

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
			description: "native " + name,
			parameters: { type: "object", properties: {} },
		},
	}
}

function createMockMcpServer(name: string, tools: McpTool[]): McpServer {
	return {
		name: name,
		config: JSON.stringify({ type: "stdio", command: "test" }),
		status: "connected",
		source: "global",
		tools: tools,
	} as McpServer
}

function createMockMcpHub(servers: McpServer[]): Partial<McpHub> {
	return {
		getServers: vi.fn().mockReturnValue(servers),
	}
}

// A mode with 'mcp' group + server disabled
const modeServerDisabled: ModeConfig = {
	slug: "mode-server-disabled",
	name: "Server Disabled",
	roleDefinition: "test",
	groups: [
		"read",
		"edit",
		"command",
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

// A mode with 'mcp' group and no filtering
const modeNoFilter: ModeConfig = {
	slug: "mode-no-filter",
	name: "No Filter",
	roleDefinition: "test",
	groups: ["read", "edit", "command", "mcp"],
}

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { buildNativeToolsArrayWithRestrictions } from "../../../core/task/build-tools"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("build-tools MCP filtering (Gemini path)", () => {
	function createMockProvider(mcpHub: Partial<McpHub>) {
		return {
			getMcpHub: vi.fn().mockReturnValue(mcpHub),
			context: {} as any,
		} as any
	}

	it("uses filteredMcpTools in allTools when includeAllToolsWithRestrictions is true", async () => {
		const mcpHub = createMockMcpHub([
			createMockMcpServer("weather-server", [{ name: "get_forecast", description: "forecast" } as McpTool]),
			createMockMcpServer("db-server", [{ name: "query", description: "query db" } as McpTool]),
		])

		const result = await buildNativeToolsArrayWithRestrictions({
			provider: createMockProvider(mcpHub),
			cwd: "/test",
			mode: "mode-server-disabled",
			customModes: [modeServerDisabled],
			experiments: {},
			apiConfiguration: undefined,
			includeAllToolsWithRestrictions: true,
		})

		// allTools should use filteredMcpTools, so weather-server tools excluded
		const toolNames = result.tools.map((t: any) => t.function.name)
		expect(toolNames).not.toContain("mcp--weather-server--get_forecast")
		expect(toolNames).toContain("mcp--db-server--query")
	})

	// ISSUE-19: Native tools remain unfiltered in Gemini's tool list.
	it("native tools remain unfiltered in allTools (ISSUE-19)", async () => {
		const mcpHub = createMockMcpHub([])

		const result = await buildNativeToolsArrayWithRestrictions({
			provider: createMockProvider(mcpHub),
			cwd: "/test",
			mode: "mode-no-filter",
			customModes: [modeNoFilter],
			experiments: {},
			apiConfiguration: undefined,
			includeAllToolsWithRestrictions: true,
		})

		// allTools should contain unfiltered native tools (e.g. write_to_file)
		// even though mode filtering would restrict some. This is intentional
		// because Gemini uses allowedFunctionNames to restrict callable tools.
		const toolNames = result.tools.map((t: any) => t.function.name)
		// Native tools should be present (unfiltered in allTools)
		expect(toolNames.length).toBeGreaterThan(0)
		// The tools array should contain native tools
		const hasNativeTools = toolNames.some((n: string) => !n.startsWith("mcp--"))
		expect(hasNativeTools).toBe(true)
	})

	it("excludes all tools from a disabled server in allTools", async () => {
		const mcpHub = createMockMcpHub([
			createMockMcpServer("weather-server", [
				{ name: "get_forecast", description: "f" } as McpTool,
				{ name: "get_alerts", description: "a" } as McpTool,
			]),
		])

		const result = await buildNativeToolsArrayWithRestrictions({
			provider: createMockProvider(mcpHub),
			cwd: "/test",
			mode: "mode-server-disabled",
			customModes: [modeServerDisabled],
			experiments: {},
			apiConfiguration: undefined,
			includeAllToolsWithRestrictions: true,
		})

		const mcpToolNames = result.tools.map((t: any) => t.function.name).filter((n: string) => n.startsWith("mcp--"))

		expect(mcpToolNames).toHaveLength(0)
	})
})
