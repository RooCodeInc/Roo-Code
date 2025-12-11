import { describe, it, expect } from "vitest"
import { checkAutoApproval } from "../index"
import type { ExtensionState } from "../../../shared/ExtensionMessage"
import type { McpServer } from "../../../shared/mcp"

describe("checkAutoApproval", () => {
	describe("MCP tool auto-approval", () => {
		it("should auto-approve MCP tools when alwaysAllowMcp is true and tool has no explicit alwaysAllow", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [
					{
						name: "test-server",
						config: "test",
						status: "connected",
						tools: [
							{
								name: "test-tool",
								description: "Test tool",
								// No alwaysAllow property - should default to auto-approve
							},
						],
					} as McpServer,
				],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "test-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve MCP tools when alwaysAllowMcp is true and tool has alwaysAllow=true", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [
					{
						name: "test-server",
						config: "test",
						status: "connected",
						tools: [
							{
								name: "test-tool",
								description: "Test tool",
								alwaysAllow: true,
							},
						],
					} as McpServer,
				],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "test-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			expect(result.decision).toBe("approve")
		})

		it("should NOT auto-approve MCP tools when tool explicitly has alwaysAllow=false", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [
					{
						name: "test-server",
						config: "test",
						status: "connected",
						tools: [
							{
								name: "test-tool",
								description: "Test tool",
								alwaysAllow: false, // Explicitly disabled
							},
						],
					} as McpServer,
				],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "test-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			expect(result.decision).toBe("ask")
		})

		it("should NOT auto-approve MCP tools when alwaysAllowMcp is false", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: false, // Global MCP auto-approval disabled
				mcpServers: [
					{
						name: "test-server",
						config: "test",
						status: "connected",
						tools: [
							{
								name: "test-tool",
								description: "Test tool",
							},
						],
					} as McpServer,
				],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "test-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			expect(result.decision).toBe("ask")
		})

		it("should NOT auto-approve when autoApprovalEnabled is false", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: false, // Auto-approval completely disabled
				alwaysAllowMcp: true,
				mcpServers: [],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "test-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			expect(result.decision).toBe("ask")
		})

		it("should auto-approve MCP resources when alwaysAllowMcp is true", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [],
			}

			const mcpServerUse = JSON.stringify({
				type: "access_mcp_resource",
				serverName: "test-server",
				resourceUri: "test://resource",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			expect(result.decision).toBe("approve")
		})

		it("should handle missing or unknown servers gracefully", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [
					{
						name: "different-server",
						config: "test",
						status: "connected",
						tools: [],
					} as McpServer,
				],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "unknown-server",
				toolName: "test-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			// Should still auto-approve since alwaysAllowMcp is true and tool doesn't exist to have alwaysAllow=false
			expect(result.decision).toBe("approve")
		})

		it("should handle missing tools gracefully", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [
					{
						name: "test-server",
						config: "test",
						status: "connected",
						tools: [
							{
								name: "different-tool",
								description: "Different tool",
							},
						],
					} as McpServer,
				],
			}

			const mcpServerUse = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "unknown-tool",
			})

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: mcpServerUse,
			})

			// Should still auto-approve since alwaysAllowMcp is true and tool doesn't exist to have alwaysAllow=false
			expect(result.decision).toBe("approve")
		})

		it("should handle invalid JSON gracefully", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [],
			}

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: "invalid json",
			})

			expect(result.decision).toBe("ask")
		})

		it("should handle missing text gracefully", async () => {
			const state: Partial<ExtensionState> = {
				autoApprovalEnabled: true,
				alwaysAllowMcp: true,
				mcpServers: [],
			}

			const result = await checkAutoApproval({
				state: state as any,
				ask: "use_mcp_server",
				text: undefined,
			})

			expect(result.decision).toBe("ask")
		})
	})
})
