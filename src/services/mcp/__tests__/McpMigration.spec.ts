import { describe, it, expect } from "vitest"
import { migrateMcpSettings, validateMcpSettings } from "../McpMigration"

describe("McpMigration", () => {
	describe("migrateMcpSettings", () => {
		it("should handle empty settings", () => {
			const result = migrateMcpSettings(null)
			expect(result).toEqual({ mcpServers: {} })
		})

		it("should handle empty object", () => {
			const result = migrateMcpSettings({})
			expect(result).toEqual({ mcpServers: {} })
		})

		it("should migrate legacy server config with defaults", () => {
			const legacyConfig = {
				mcpServers: {
					"test-server": {
						command: "python",
						args: ["-m", "my_server"],
						// No new Jabberwock fields
					},
				},
			}

			const result = migrateMcpSettings(legacyConfig)

			expect(result.mcpServers["test-server"]).toMatchObject({
				command: "python",
				args: ["-m", "my_server"],
				isGloballyVisible: true,
				type: "tool",
				allowedContext: [],
				alwaysAllow: [],
				disabledTools: [],
			})
		})

		it("should preserve new Jabberwock fields", () => {
			const newConfig = {
				mcpServers: {
					"interactive-app": {
						command: "node",
						args: ["interactive.js"],
						type: "interactiveApp",
						uiType: "todo-widget",
						requiresUserInteraction: true,
						isGloballyVisible: false,
						allowedContext: ["agents"],
					},
				},
			}

			const result = migrateMcpSettings(newConfig)

			expect(result.mcpServers["interactive-app"]).toMatchObject({
				command: "node",
				args: ["interactive.js"],
				type: "interactiveApp",
				uiType: "todo-widget",
				requiresUserInteraction: true,
				isGloballyVisible: false,
				allowedContext: ["agents"],
			})
		})
	})

	describe("validateMcpSettings", () => {
		it("should validate correct settings", () => {
			const validSettings = {
				mcpServers: {
					"test-server": {
						command: "python",
						args: ["-m", "server"],
						type: "tool",
					},
				},
			}

			const result = validateMcpSettings(validSettings)
			expect(result.success).toBe(true)
		})

		it("should reject invalid settings", () => {
			const invalidSettings = {
				mcpServers: {
					"test-server": {
						// Missing required command field
						type: "tool",
					},
				},
			}

			const result = validateMcpSettings(invalidSettings)
			expect(result.success).toBe(false)
			expect(result.errors).toBeDefined()
		})
	})
})
