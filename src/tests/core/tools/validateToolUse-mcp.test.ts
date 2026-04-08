// cd src && npx vitest run tests/core/tools/validateToolUse-mcp.test.ts

import type { ModeConfig } from "@roo-code/types"

import { validateToolUse } from "../../../core/tools/validateToolUse"

// ---------------------------------------------------------------------------
// Helper: build a custom mode with MCP filtering options
// ---------------------------------------------------------------------------

function buildMcpMode(slug: string, mcpOptions?: Record<string, unknown>): ModeConfig {
	const mcpGroup = mcpOptions ? ["mcp", mcpOptions] : "mcp"
	return {
		slug,
		name: slug,
		roleDefinition: "test mode",
		groups: ["read", mcpGroup] as any,
	}
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// Mode that allows serverA but disables serverB
const modeWithFilter = buildMcpMode("filtered", {
	mcpServers: {
		serverA: { disabled: false },
		serverB: { disabled: true },
	},
})

// Mode with deny-default policy (unlisted servers are blocked)
const modeDenyDefault = buildMcpMode("deny-default", {
	mcpDefaultPolicy: "deny",
	mcpServers: {
		allowedServer: { disabled: false },
	},
})

// Mode with tool-level filtering on serverC
const modeToolFilter = buildMcpMode("tool-filter", {
	mcpServers: {
		serverC: {
			disabled: false,
			disabledTools: ["blocked_tool"],
		},
	},
})

// Mode with no MCP filtering (plain 'mcp' group)
const modeNoFilter = buildMcpMode("no-filter")

const customModes: ModeConfig[] = [modeWithFilter, modeDenyDefault, modeToolFilter, modeNoFilter]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateToolUse — MCP filtering", () => {
	// ----- use_mcp_tool -----

	describe("use_mcp_tool", () => {
		it("does not throw when server is allowed", () => {
			expect(() =>
				validateToolUse("use_mcp_tool", "filtered", customModes, undefined, {
					server_name: "serverA",
					tool_name: "any_tool",
				}),
			).not.toThrow()
		})

		it("throws when server is disabled", () => {
			expect(() =>
				validateToolUse("use_mcp_tool", "filtered", customModes, undefined, {
					server_name: "serverB",
					tool_name: "any_tool",
				}),
			).toThrow('MCP server "serverB" is not allowed in filtered mode')
		})

		it("extracts server_name from toolParams", () => {
			// serverB is disabled — the function must read server_name from params
			expect(() =>
				validateToolUse("use_mcp_tool", "filtered", customModes, undefined, { server_name: "serverB" }),
			).toThrow("serverB")
		})

		it("ISSUE-21: also checks tool-level when tool_name is available", () => {
			expect(() =>
				validateToolUse("use_mcp_tool", "tool-filter", customModes, undefined, {
					server_name: "serverC",
					tool_name: "blocked_tool",
				}),
			).toThrow('MCP tool "blocked_tool" on server "serverC" is not allowed')
		})

		it("ISSUE-21: allows tool when not in disabledTools", () => {
			expect(() =>
				validateToolUse("use_mcp_tool", "tool-filter", customModes, undefined, {
					server_name: "serverC",
					tool_name: "ok_tool",
				}),
			).not.toThrow()
		})
	})

	// ----- access_mcp_resource -----

	describe("access_mcp_resource", () => {
		it("does not throw when server is allowed", () => {
			expect(() =>
				validateToolUse("access_mcp_resource", "filtered", customModes, undefined, {
					server_name: "serverA",
					uri: "res://x",
				}),
			).not.toThrow()
		})

		it("throws when server is disabled", () => {
			expect(() =>
				validateToolUse("access_mcp_resource", "filtered", customModes, undefined, {
					server_name: "serverB",
					uri: "res://x",
				}),
			).toThrow('MCP server "serverB" is not allowed in filtered mode')
		})
	})

	// ----- Dynamic MCP tools (mcp--server--tool) -----

	describe("dynamic MCP tools", () => {
		it("allows when server and tool are permitted", () => {
			expect(() => validateToolUse("mcp--serverA--some_tool" as any, "filtered", customModes)).not.toThrow()
		})

		it("throws when server is disabled", () => {
			expect(() => validateToolUse("mcp--serverB--some_tool" as any, "filtered", customModes)).toThrow(
				"not allowed in filtered mode",
			)
		})

		it("throws when tool is in disabledTools", () => {
			expect(() => validateToolUse("mcp--serverC--blocked_tool" as any, "tool-filter", customModes)).toThrow(
				"not allowed in tool-filter mode",
			)
		})

		it("throws with deny default policy and unlisted server", () => {
			expect(() => validateToolUse("mcp--unknownServer--tool" as any, "deny-default", customModes)).toThrow(
				"not allowed in deny-default mode",
			)
		})

		it("allows with deny policy when server is explicitly allowed", () => {
			expect(() => validateToolUse("mcp--allowedServer--tool" as any, "deny-default", customModes)).not.toThrow()
		})
	})

	// ----- Non-MCP tools unaffected -----

	describe("non-MCP tools", () => {
		it("are unaffected by MCP filtering", () => {
			// read_file is a regular tool in the read group — should still work
			expect(() => validateToolUse("read_file", "filtered", customModes)).not.toThrow()
		})
	})
})
