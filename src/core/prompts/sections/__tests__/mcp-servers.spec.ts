import type { McpServer, McpTool } from "@roo-code/types"

import type { McpHub } from "../../../../services/mcp/McpHub"

import { getMcpServersSection } from "../mcp-servers"

describe("getMcpServersSection", () => {
	const createMockTool = (name: string, description = "Test tool", enabledForPrompt?: boolean): McpTool => ({
		name,
		description,
		inputSchema: {
			type: "object",
			properties: {},
		},
		...(enabledForPrompt !== undefined ? { enabledForPrompt } : {}),
	})

	const createMockServer = (
		name: string,
		tools: McpTool[],
		options: { instructions?: string; source?: "global" | "project" } = {},
	): McpServer => ({
		name,
		config: JSON.stringify({ type: "stdio", command: "test" }),
		status: "connected",
		source: options.source ?? "global",
		tools,
		instructions: options.instructions,
	})

	const createMockMcpHub = (servers: McpServer[]): Partial<McpHub> => ({
		getServers: vi.fn().mockReturnValue(servers),
	})

	it("should return empty string when mcpHub is undefined", () => {
		const result = getMcpServersSection(undefined)
		expect(result).toBe("")
	})

	it("should return empty string when no servers are available", () => {
		const mockHub = createMockMcpHub([])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toBe("")
	})

	it("should return empty string when servers have no enabled tools", () => {
		const server = createMockServer("testServer", [])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toBe("")
	})

	it("should return empty string when all tools are disabled", () => {
		const server = createMockServer("testServer", [
			createMockTool("tool1", "Tool 1", false),
			createMockTool("tool2", "Tool 2", false),
		])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toBe("")
	})

	it("should include MCP SERVERS header", () => {
		const server = createMockServer("testServer", [createMockTool("testTool")])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("MCP SERVERS")
	})

	it("should explain the naming convention", () => {
		const server = createMockServer("testServer", [createMockTool("testTool")])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("mcp--serverName--toolName")
	})

	it("should list server name as heading", () => {
		const server = createMockServer("context7", [createMockTool("resolve-library-id")])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("## context7")
	})

	it("should list tool names using the mcp-- naming convention", () => {
		const server = createMockServer("context7", [
			createMockTool("resolve-library-id"),
			createMockTool("get-library-docs"),
		])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("mcp--context7--resolve-library-id")
		expect(result).toContain("mcp--context7--get-library-docs")
	})

	it("should include server instructions when provided", () => {
		const server = createMockServer("conport", [createMockTool("init-db")], {
			instructions: "Always initialize the database before performing queries.",
		})
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("Server Instructions:")
		expect(result).toContain("Always initialize the database before performing queries.")
	})

	it("should not include server instructions section when not provided", () => {
		const server = createMockServer("testServer", [createMockTool("testTool")])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).not.toContain("Server Instructions:")
	})

	it("should list multiple servers", () => {
		const server1 = createMockServer("context7", [createMockTool("resolve-library-id")])
		const server2 = createMockServer("git", [createMockTool("git-status")])
		const mockHub = createMockMcpHub([server1, server2])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("## context7")
		expect(result).toContain("## git")
		expect(result).toContain("mcp--context7--resolve-library-id")
		expect(result).toContain("mcp--git--git-status")
	})

	it("should filter out disabled tools", () => {
		const server = createMockServer("testServer", [
			createMockTool("enabledTool", "Enabled tool"),
			createMockTool("disabledTool", "Disabled tool", false),
		])
		const mockHub = createMockMcpHub([server])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).toContain("mcp--testServer--enabledTool")
		expect(result).not.toContain("mcp--testServer--disabledTool")
	})

	it("should skip servers with only disabled tools", () => {
		const serverWithDisabledTools = createMockServer("disabledServer", [createMockTool("tool1", "Tool 1", false)])
		const serverWithEnabledTools = createMockServer("enabledServer", [createMockTool("tool1", "Tool 1")])
		const mockHub = createMockMcpHub([serverWithDisabledTools, serverWithEnabledTools])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).not.toContain("## disabledServer")
		expect(result).toContain("## enabledServer")
	})

	it("should skip servers with undefined tools", () => {
		const serverWithUndefinedTools: McpServer = {
			name: "noTools",
			config: JSON.stringify({ type: "stdio", command: "test" }),
			status: "connected",
			tools: undefined,
		}
		const serverWithTools = createMockServer("withTools", [createMockTool("tool1")])
		const mockHub = createMockMcpHub([serverWithUndefinedTools, serverWithTools])
		const result = getMcpServersSection(mockHub as McpHub)
		expect(result).not.toContain("## noTools")
		expect(result).toContain("## withTools")
	})
})
