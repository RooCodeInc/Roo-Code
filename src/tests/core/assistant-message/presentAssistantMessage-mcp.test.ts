/**
 * Tests for Step 5b: MCP tool_use filter in presentAssistantMessage.
 *
 * Tests the shouldAllowMcpToolUse helper that gates MCP tool execution
 * in the mcp_tool_use case block. Verifies that:
 * - Allowed MCP tools proceed normally
 * - Blocked MCP servers are rejected
 * - Blocked MCP tools (tool-level filter) are rejected
 * - The check uses cline.taskMode (frozen at task start), NOT state.mode
 */

import type { ModeConfig } from "@roo-code/types"
import { shouldAllowMcpToolUse } from "../../../core/assistant-message/presentAssistantMessage"
import * as mcpFilter from "../../../utils/mcp-filter"

describe("shouldAllowMcpToolUse", () => {
	it("should return true when isMcpToolAllowedForMode returns true", () => {
		const result = shouldAllowMcpToolUse("my-server", "my-tool", "code", undefined)
		// With no custom modes and default built-in modes,
		// mcp group is present in code mode so all tools are allowed
		expect(result).toBe(true)
	})

	it("should return false when the MCP server is blocked for the mode", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "restricted",
				name: "Restricted",
				roleDefinition: "A restricted mode",
				groups: [
					[
						"mcp",
						{
							mcpServers: {
								"blocked-server": { disabled: true },
							},
						},
					],
				],
			},
		]

		const result = shouldAllowMcpToolUse("blocked-server", "any-tool", "restricted", customModes)
		expect(result).toBe(false)
	})

	it("should return false when a specific tool is blocked via disabledTools", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "tool-restricted",
				name: "Tool Restricted",
				roleDefinition: "A mode with tool-level restrictions",
				groups: [
					[
						"mcp",
						{
							mcpServers: {
								"my-server": {
									disabled: false,
									disabledTools: ["secret-tool"],
								},
							},
						},
					],
				],
			},
		]

		const result = shouldAllowMcpToolUse("my-server", "secret-tool", "tool-restricted", customModes)
		expect(result).toBe(false)
	})

	it("should return true for a non-disabled tool on same server", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "tool-restricted",
				name: "Tool Restricted",
				roleDefinition: "A mode with tool-level restrictions",
				groups: [
					[
						"mcp",
						{
							mcpServers: {
								"my-server": {
									disabled: false,
									disabledTools: ["secret-tool"],
								},
							},
						},
					],
				],
			},
		]

		const result = shouldAllowMcpToolUse("my-server", "public-tool", "tool-restricted", customModes)
		expect(result).toBe(true)
	})

	it("should return false when tool not in allowedTools list", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "allowlist-mode",
				name: "Allowlist Mode",
				roleDefinition: "A mode with allowedTools",
				groups: [
					[
						"mcp",
						{
							mcpServers: {
								"my-server": {
									disabled: false,
									allowedTools: ["tool-a", "tool-b"],
								},
							},
						},
					],
				],
			},
		]

		const result = shouldAllowMcpToolUse("my-server", "tool-c", "allowlist-mode", customModes)
		expect(result).toBe(false)
	})

	it("should return true when tool is in allowedTools list", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "allowlist-mode",
				name: "Allowlist Mode",
				roleDefinition: "A mode with allowedTools",
				groups: [
					[
						"mcp",
						{
							mcpServers: {
								"my-server": {
									disabled: false,
									allowedTools: ["tool-a", "tool-b"],
								},
							},
						},
					],
				],
			},
		]

		const result = shouldAllowMcpToolUse("my-server", "tool-a", "allowlist-mode", customModes)
		expect(result).toBe(true)
	})

	it("should use the provided modeSlug (taskMode), not derive it from state", () => {
		// This test verifies the function signature accepts modeSlug directly.
		// The caller (presentAssistantMessage) passes cline.taskMode, not state.mode.
		// We verify by passing a mode slug that blocks the server vs one that allows it.

		const customModes: ModeConfig[] = [
			{
				slug: "strict-mode",
				name: "Strict",
				roleDefinition: "Strict mode",
				groups: [
					[
						"mcp",
						{
							mcpServers: {
								"test-server": { disabled: true },
							},
						},
					],
				],
			},
			{
				slug: "lax-mode",
				name: "Lax",
				roleDefinition: "Lax mode",
				groups: ["mcp"],
			},
		]

		// strict-mode blocks test-server
		expect(shouldAllowMcpToolUse("test-server", "any-tool", "strict-mode", customModes)).toBe(false)

		// lax-mode allows everything (plain 'mcp' string = no filtering)
		expect(shouldAllowMcpToolUse("test-server", "any-tool", "lax-mode", customModes)).toBe(true)
	})

	it("should delegate to isMcpToolAllowedForMode from mcp-filter", () => {
		const spy = vi.spyOn(mcpFilter, "isMcpToolAllowedForMode")

		shouldAllowMcpToolUse("srv", "tl", "code", undefined)

		expect(spy).toHaveBeenCalledWith("srv", "tl", "code", undefined)
		spy.mockRestore()
	})

	it("should return true when mode has no mcp group at all", () => {
		const customModes: ModeConfig[] = [
			{
				slug: "no-mcp",
				name: "No MCP",
				roleDefinition: "Mode without mcp group",
				groups: ["read", "edit"],
			},
		]

		const result = shouldAllowMcpToolUse("any-server", "any-tool", "no-mcp", customModes)
		// No mcp group → no filtering → allow
		expect(result).toBe(true)
	})
})
