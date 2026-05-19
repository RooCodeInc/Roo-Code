// npx vitest run core/prompts/tools/__tests__/filter-tools-for-mode.spec.ts

import type OpenAI from "openai"
import type { McpHub } from "../../../../services/mcp/McpHub"
import type { McpServer } from "@roo-code/types"

import { filterNativeToolsForMode } from "../filter-tools-for-mode"

function makeTool(name: string): OpenAI.Chat.ChatCompletionTool {
	return {
		type: "function",
		function: {
			name,
			description: `${name} tool`,
			parameters: { type: "object", properties: {} },
		},
	} as OpenAI.Chat.ChatCompletionTool
}

function createMockMcpHub(servers: McpServer[]): McpHub {
	return {
		getServers: () => servers,
	} as unknown as McpHub
}

describe("filterNativeToolsForMode - disabledTools", () => {
	const nativeTools: OpenAI.Chat.ChatCompletionTool[] = [
		makeTool("execute_command"),
		makeTool("read_file"),
		makeTool("write_to_file"),
		makeTool("apply_diff"),
		makeTool("edit"),
	]

	it("removes tools listed in settings.disabledTools", () => {
		const settings = {
			disabledTools: ["execute_command"],
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("execute_command")
		expect(resultNames).toContain("read_file")
		expect(resultNames).toContain("write_to_file")
		expect(resultNames).toContain("apply_diff")
	})

	it("does not remove any tools when disabledTools is empty", () => {
		const settings = {
			disabledTools: [],
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).toContain("execute_command")
		expect(resultNames).toContain("read_file")
		expect(resultNames).toContain("write_to_file")
		expect(resultNames).toContain("apply_diff")
	})

	it("does not remove any tools when disabledTools is undefined", () => {
		const settings = {}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).toContain("execute_command")
		expect(resultNames).toContain("read_file")
	})

	it("combines disabledTools with other setting-based exclusions", () => {
		const settings = {
			disabledTools: ["execute_command"],
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("execute_command")
		expect(resultNames).toContain("read_file")
	})

	it("disables canonical tool when disabledTools contains alias name", () => {
		const settings = {
			disabledTools: ["search_and_replace"],
			modelInfo: {
				includedTools: ["search_and_replace"],
			},
		}

		const result = filterNativeToolsForMode(nativeTools, "code", undefined, undefined, undefined, settings)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("search_and_replace")
		expect(resultNames).not.toContain("edit")
	})
})

describe("filterNativeToolsForMode - access_mcp_resource with resource templates", () => {
	const toolsWithMcpResource: OpenAI.Chat.ChatCompletionTool[] = [
		makeTool("read_file"),
		makeTool("access_mcp_resource"),
	]

	it("includes access_mcp_resource when server has only resource templates", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "template-server",
				config: "{}",
				status: "connected",
				resources: [],
				resourceTemplates: [
					{
						uriTemplate: "test://resource/{id}",
						name: "Test Resource",
					},
				],
			},
		])

		const result = filterNativeToolsForMode(
			toolsWithMcpResource,
			"code",
			undefined,
			undefined,
			undefined,
			undefined,
			mcpHub,
		)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).toContain("access_mcp_resource")
	})

	it("includes access_mcp_resource when server has only static resources", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "static-server",
				config: "{}",
				status: "connected",
				resources: [
					{
						uri: "test://static",
						name: "Static Resource",
					},
				],
				resourceTemplates: [],
			},
		])

		const result = filterNativeToolsForMode(
			toolsWithMcpResource,
			"code",
			undefined,
			undefined,
			undefined,
			undefined,
			mcpHub,
		)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).toContain("access_mcp_resource")
	})

	it("excludes access_mcp_resource when no mcpHub is provided", () => {
		const result = filterNativeToolsForMode(
			toolsWithMcpResource,
			"code",
			undefined,
			undefined,
			undefined,
			undefined,
		)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("access_mcp_resource")
	})

	it("excludes access_mcp_resource when server has no resources or templates", () => {
		const mcpHub = createMockMcpHub([
			{
				name: "empty-server",
				config: "{}",
				status: "connected",
				resources: [],
				resourceTemplates: [],
			},
		])

		const result = filterNativeToolsForMode(
			toolsWithMcpResource,
			"code",
			undefined,
			undefined,
			undefined,
			undefined,
			mcpHub,
		)

		const resultNames = result.map((t) => (t as any).function.name)
		expect(resultNames).not.toContain("access_mcp_resource")
	})
})
