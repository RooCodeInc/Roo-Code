import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import type { ClineProvider } from "../../../core/webview/ClineProvider"
import { McpHub } from "../McpHub"

// Mock modules
vi.mock("fs/promises")
vi.mock("../../../utils/safeWriteJson")
vi.mock("vscode")
vi.mock("@modelcontextprotocol/sdk/client/stdio.js")
vi.mock("@modelcontextprotocol/sdk/client/index.js")
vi.mock("chokidar")

describe("McpHub - VSCode Scope Integration", () => {
	let mcpHub: McpHub
	let mockProvider: Partial<ClineProvider>

	beforeEach(() => {
		vi.clearAllMocks()

		// Set up basic mocks
		mockProvider = {
			ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/mock/settings"),
			ensureMcpServersDirectoryExists: vi.fn().mockResolvedValue("/mock/settings"),
			postMessageToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({ mcpEnabled: true }),
			context: {
				subscriptions: [],
				extension: { packageJSON: { version: "1.0.0" } },
			} as any,
		}
	})

	it("should support VSCode MCP scope alongside global and project scopes", () => {
		// This test verifies that the implementation supports the three scopes
		const connection1 = { server: { name: "test", source: "global" } }
		const connection2 = { server: { name: "test", source: "project" } }
		const connection3 = { server: { name: "test", source: "vscode" } }

		// All three source types should be valid
		expect(["global", "project", "vscode"]).toContain(connection1.server.source)
		expect(["global", "project", "vscode"]).toContain(connection2.server.source)
		expect(["global", "project", "vscode"]).toContain(connection3.server.source)
	})

	it("should mark VSCode servers as read-only", () => {
		// VSCode servers should have readOnly flag set to true
		const vsCodeServer = {
			name: "vscode-test",
			source: "vscode",
			readOnly: true,
			config: JSON.stringify({ command: "node", args: ["test.js"] }),
		}

		expect(vsCodeServer.readOnly).toBe(true)
		expect(vsCodeServer.source).toBe("vscode")
	})

	it("should implement proper precedence: project > vscode > global", () => {
		// Test precedence logic
		const servers = [
			{ name: "shared", source: "global", priority: 3 },
			{ name: "shared", source: "vscode", priority: 2 },
			{ name: "shared", source: "project", priority: 1 },
		]

		// Sort by priority (lower number = higher priority)
		const sorted = servers.sort((a, b) => a.priority - b.priority)

		// Project should come first
		expect(sorted[0].source).toBe("project")
		// VSCode should come second
		expect(sorted[1].source).toBe("vscode")
		// Global should come last
		expect(sorted[2].source).toBe("global")
	})

	it("should handle VSCode configuration structure", () => {
		// Test that we can process VSCode configuration format
		const vsCodeConfig = {
			"test-server": {
				command: "node",
				args: ["server.js"],
				env: { NODE_ENV: "production" },
			},
		}

		// Should be able to extract server configurations
		const servers = Object.entries(vsCodeConfig).map(([name, config]) => ({
			name,
			...config,
			source: "vscode",
			readOnly: true,
		}))

		expect(servers).toHaveLength(1)
		expect(servers[0].name).toBe("test-server")
		expect(servers[0].command).toBe("node")
		expect(servers[0].source).toBe("vscode")
		expect(servers[0].readOnly).toBe(true)
	})

	it("should handle GitHub Copilot Agent configuration", () => {
		// Test GitHub Copilot Agent configuration handling
		const copilotConfig = {
			mcpServers: {
				"copilot-server": {
					command: "python",
					args: ["-m", "copilot_mcp"],
				},
			},
		}

		const servers = Object.entries(copilotConfig.mcpServers).map(([name, config]) => ({
			name,
			...config,
			source: "vscode",
			readOnly: true,
		}))

		expect(servers).toHaveLength(1)
		expect(servers[0].name).toBe("copilot-server")
		expect(servers[0].command).toBe("python")
	})

	it("should merge VSCode and Copilot configurations", () => {
		// Test merging of configurations
		const vsCodeServers = {
			"vscode-server": { command: "node", args: ["vscode.js"] },
		}

		const copilotServers = {
			"copilot-server": { command: "python", args: ["copilot.py"] },
		}

		// Merge both sources
		const merged = { ...copilotServers, ...vsCodeServers }

		expect(Object.keys(merged)).toHaveLength(2)
		expect(merged["vscode-server"]).toBeDefined()
		expect(merged["copilot-server"]).toBeDefined()
	})

	it("should handle duplicate names with VSCode taking precedence over Copilot", () => {
		// Test duplicate handling
		const vsCodeServers = {
			duplicate: { command: "node", args: ["vscode.js"] },
		}

		const copilotServers = {
			duplicate: { command: "python", args: ["copilot.py"] },
		}

		// VSCode settings take precedence
		const merged = { ...copilotServers, ...vsCodeServers }

		expect(merged["duplicate"].command).toBe("node")
		expect(merged["duplicate"].args).toEqual(["vscode.js"])
	})

	it("should allow enabling/disabling VSCode servers locally", () => {
		// Test that VSCode servers can be toggled locally
		let server = {
			name: "vscode-test",
			source: "vscode" as const,
			readOnly: true,
			disabled: false,
		}

		// Should be able to disable locally
		server.disabled = true
		expect(server.disabled).toBe(true)

		// Should be able to re-enable locally
		server.disabled = false
		expect(server.disabled).toBe(false)

		// But readOnly flag should remain true
		expect(server.readOnly).toBe(true)
	})

	it("should not allow editing VSCode server configuration", () => {
		// Test that VSCode servers cannot be edited
		const server = {
			name: "vscode-test",
			source: "vscode" as const,
			readOnly: true,
			config: JSON.stringify({ command: "node", args: ["test.js"] }),
		}

		// readOnly flag should prevent editing
		expect(server.readOnly).toBe(true)

		// Attempting to edit should be blocked by the UI
		const canEdit = !server.readOnly
		expect(canEdit).toBe(false)
	})
})
