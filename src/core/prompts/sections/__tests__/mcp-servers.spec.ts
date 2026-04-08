import type { McpHub } from "../../../../services/mcp/McpHub"

import { getMcpServersSection } from "../mcp-servers"

const createMockMcpHub = (servers: any[]): McpHub =>
	({
		getServers: () => servers,
	}) as unknown as McpHub

describe("getMcpServersSection", () => {
	it("should return empty string when mcpHub is undefined", () => {
		const result = getMcpServersSection(undefined)
		expect(result).toBe("")
	})

	it("should return empty string when no servers are connected", () => {
		const hub = createMockMcpHub([])
		const result = getMcpServersSection(hub)
		expect(result).toBe("")
	})

	it("should return empty string when servers exist but none are connected", () => {
		const hub = createMockMcpHub([
			{
				name: "test-server",
				status: "disconnected",
				tools: [{ name: "tool1", description: "A tool" }],
			},
		])
		const result = getMcpServersSection(hub)
		expect(result).toBe("")
	})

	it("should include connected server with tools", () => {
		const hub = createMockMcpHub([
			{
				name: "git",
				status: "connected",
				tools: [
					{ name: "git_log", description: "Show git log" },
					{ name: "git_status", description: "Show git status" },
				],
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("MCP SERVERS")
		expect(result).toContain("## git")
		expect(result).toContain("mcp--git--git_log")
		expect(result).toContain("mcp--git--git_status")
		expect(result).toContain("mcp--serverName--toolName")
	})

	it("should filter out tools with enabledForPrompt === false", () => {
		const hub = createMockMcpHub([
			{
				name: "testServer",
				status: "connected",
				tools: [
					{ name: "enabled_tool", description: "Enabled", enabledForPrompt: true },
					{ name: "disabled_tool", description: "Disabled", enabledForPrompt: false },
					{ name: "default_tool", description: "Default (no flag)" },
				],
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("mcp--testServer--enabled_tool")
		expect(result).not.toContain("disabled_tool")
		expect(result).toContain("mcp--testServer--default_tool")
	})

	it("should include server instructions when available", () => {
		const hub = createMockMcpHub([
			{
				name: "context7",
				status: "connected",
				instructions: "Always use resolve-library-id before get-library-docs.",
				tools: [{ name: "resolve-library-id", description: "Resolve lib" }],
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("## context7")
		expect(result).toContain("Instructions: Always use resolve-library-id before get-library-docs.")
		expect(result).toContain("mcp--context7--resolve-library-id")
	})

	it("should not include instructions block when server has no instructions", () => {
		const hub = createMockMcpHub([
			{
				name: "simple-server",
				status: "connected",
				tools: [{ name: "do_thing", description: "Does a thing" }],
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("## simple-server")
		expect(result).not.toContain("Instructions:")
	})

	it("should handle server with no tools", () => {
		const hub = createMockMcpHub([
			{
				name: "no-tools-server",
				status: "connected",
				tools: undefined,
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("## no-tools-server")
		expect(result).toContain("(No tools available)")
	})

	it("should handle multiple connected servers", () => {
		const hub = createMockMcpHub([
			{
				name: "git",
				status: "connected",
				tools: [{ name: "git_log", description: "Show log" }],
			},
			{
				name: "context7",
				status: "connected",
				instructions: "Resolve library IDs first.",
				tools: [{ name: "resolve-library-id", description: "Resolve lib" }],
			},
			{
				name: "offline-server",
				status: "disconnected",
				tools: [{ name: "should_not_appear", description: "Hidden" }],
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("## git")
		expect(result).toContain("## context7")
		expect(result).not.toContain("## offline-server")
		expect(result).not.toContain("should_not_appear")
	})

	it("should only include connected servers in the section", () => {
		const hub = createMockMcpHub([
			{
				name: "connecting-server",
				status: "connecting",
				tools: [{ name: "tool1", description: "Tool 1" }],
			},
		])
		const result = getMcpServersSection(hub)

		// "connecting" is not "connected", so no servers section should be generated
		expect(result).toBe("")
	})

	it("should handle server with all tools disabled", () => {
		const hub = createMockMcpHub([
			{
				name: "all-disabled",
				status: "connected",
				tools: [
					{ name: "tool1", description: "Tool 1", enabledForPrompt: false },
					{ name: "tool2", description: "Tool 2", enabledForPrompt: false },
				],
			},
		])
		const result = getMcpServersSection(hub)

		expect(result).toContain("## all-disabled")
		expect(result).toContain("(No tools available)")
		expect(result).not.toContain("mcp--all-disabled--tool1")
		expect(result).not.toContain("mcp--all-disabled--tool2")
	})
})
