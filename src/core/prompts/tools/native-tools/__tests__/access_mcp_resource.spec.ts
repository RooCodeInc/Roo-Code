// npx vitest run core/prompts/tools/native-tools/__tests__/access_mcp_resource.spec.ts

import type OpenAI from "openai"

import type { McpServer } from "@roo-code/types"

import type { McpHub } from "../../../../../services/mcp/McpHub"
import { createAccessMcpResourceTool } from "../access_mcp_resource"

// Helper type to access function tools
type FunctionTool = OpenAI.Chat.ChatCompletionTool & { type: "function" }

// Helper to get the function property from a tool
const getFunction = (tool: OpenAI.Chat.ChatCompletionTool) => (tool as FunctionTool).function

function createMockMcpHub(servers: McpServer[]): McpHub {
	return {
		getServers: () => servers,
	} as unknown as McpHub
}

describe("createAccessMcpResourceTool", () => {
	it("returns base description when no mcpHub is provided", () => {
		const tool = createAccessMcpResourceTool()
		const desc = getFunction(tool).description!
		expect(desc).toContain("Request to access a resource provided by a connected MCP server")
		expect(desc).not.toContain("Available MCP Resources")
	})

	it("returns base description when mcpHub has no servers", () => {
		const mcpHub = createMockMcpHub([])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).not.toContain("Available MCP Resources")
	})

	it("returns base description when servers have no resources or templates", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "test-server",
				config: "{}",
				status: "connected",
				tools: [],
				resources: [],
				resourceTemplates: [],
			},
		])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).not.toContain("Available MCP Resources")
	})

	it("includes static resources in description", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "weather-server",
				config: "{}",
				status: "connected",
				resources: [
					{
						uri: "weather://current",
						name: "Current Weather",
						description: "Get current weather data",
					},
				],
				resourceTemplates: [],
			},
		])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).toContain("Available MCP Resources")
		expect(desc).toContain('Server "weather-server" resources:')
		expect(desc).toContain("weather://current")
		expect(desc).toContain("Current Weather")
		expect(desc).toContain("Get current weather data")
	})

	it("includes resource templates in description", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "orbitcity",
				config: "{}",
				status: "connected",
				resources: [],
				resourceTemplates: [
					{
						uriTemplate: "orbitcity://event/details/{identifier}",
						name: "Event Details",
						description: "Get event details by identifier",
					},
					{
						uriTemplate: "orbitcity://system/history/{machine_type}/{serial}",
						name: "System History",
						description: "Get system history",
					},
				],
			},
		])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).toContain("Available MCP Resources")
		expect(desc).toContain('Server "orbitcity" resources:')
		expect(desc).toContain("orbitcity://event/details/{identifier}")
		expect(desc).toContain("Event Details")
		expect(desc).toContain("orbitcity://system/history/{machine_type}/{serial}")
		expect(desc).toContain("System History")
	})

	it("includes both resources and resource templates from the same server", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "data-server",
				config: "{}",
				status: "connected",
				resources: [
					{
						uri: "data://status",
						name: "Server Status",
					},
				],
				resourceTemplates: [
					{
						uriTemplate: "data://records/{id}",
						name: "Record by ID",
					},
				],
			},
		])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).toContain("data://status")
		expect(desc).toContain("data://records/{id}")
	})

	it("includes resources from multiple servers", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "server-a",
				config: "{}",
				status: "connected",
				resources: [{ uri: "a://resource", name: "Resource A" }],
			},
			{
				name: "server-b",
				config: "{}",
				status: "connected",
				resourceTemplates: [{ uriTemplate: "b://template/{id}", name: "Template B" }],
			},
		])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).toContain('Server "server-a" resources:')
		expect(desc).toContain("a://resource")
		expect(desc).toContain('Server "server-b" resources:')
		expect(desc).toContain("b://template/{id}")
	})

	it("handles resources without descriptions", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "minimal-server",
				config: "{}",
				status: "connected",
				resources: [{ uri: "min://data", name: "Data" }],
			},
		])
		const tool = createAccessMcpResourceTool(mcpHub)
		const desc = getFunction(tool).description!
		expect(desc).toContain("min://data (Data)")
	})

	it("always has correct tool name and parameters", () => {
		const tool = createAccessMcpResourceTool()
		const fn = getFunction(tool)
		expect(fn.name).toBe("access_mcp_resource")
		expect(fn.parameters).toBeDefined()
		const params = fn.parameters as Record<string, unknown>
		expect(params.required).toContain("server_name")
		expect(params.required).toContain("uri")
	})
})
