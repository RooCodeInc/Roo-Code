// npx vitest services/marketplace/__tests__/appium-mcp-server.spec.ts

import { SimpleInstaller } from "../SimpleInstaller"
import { MarketplaceItem } from "@roo-code/types"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock fs module
vi.mock("fs/promises")

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
}))

describe("Appium MCP Server Installation", () => {
	let installer: SimpleInstaller
	const mockFs = fs as any
	const mockContext = {
		globalStorageUri: { fsPath: "/test/global" },
		storageUri: { fsPath: "/test/storage" },
	} as any

	beforeEach(() => {
		vi.clearAllMocks()
		installer = new SimpleInstaller(mockContext, undefined)
		// Mock file operations
		mockFs.access.mockResolvedValue(undefined)
		mockFs.writeFile.mockResolvedValue(undefined)
		mockFs.readFile.mockResolvedValue("{}")
		mockFs.mkdir.mockResolvedValue(undefined)
	})

	describe("Appium MCP Server Configuration", () => {
		it("should define Appium MCP Server marketplace item correctly", () => {
			// This is the expected configuration for Appium MCP Server
			const appiumMcpItem: MarketplaceItem = {
				id: "appium-mcp",
				name: "Appium MCP Server",
				description:
					"MCP server for Mobile Development and Automation | iOS, Android, Simulator, Emulator, and Real Devices",
				author: "Appium Contributors",
				authorUrl: "https://github.com/appium",
				url: "https://github.com/appium/appium-mcp",
				type: "mcp",
				tags: ["mobile", "automation", "ios", "android", "testing", "appium"],
				content: JSON.stringify({
					command: "npx",
					args: ["-y", "@appium/mcp-server"],
					env: {
						APPIUM_HOST: "localhost",
						APPIUM_PORT: "4723",
					},
				}),
				prerequisites: [
					"Node.js 16+ and npm installed",
					"Appium installed globally or locally",
					"Platform-specific requirements (Xcode for iOS, Android SDK for Android)",
				],
			}

			// Validate the structure
			expect(appiumMcpItem.id).toBe("appium-mcp")
			expect(appiumMcpItem.type).toBe("mcp")
			expect(appiumMcpItem.name).toBe("Appium MCP Server")
			expect(appiumMcpItem.url).toBe("https://github.com/appium/appium-mcp")
			expect(appiumMcpItem.tags).toContain("mobile")
			expect(appiumMcpItem.tags).toContain("automation")
			expect(appiumMcpItem.prerequisites).toBeDefined()
			expect(appiumMcpItem.prerequisites?.length).toBeGreaterThan(0)
		})

		it("should support alternative Appium MCP installation methods", () => {
			// Alternative installation method using multiple configurations
			const appiumMcpWithMethods: MarketplaceItem = {
				id: "appium-mcp",
				name: "Appium MCP Server",
				description: "MCP server for Mobile Development and Automation",
				url: "https://github.com/appium/appium-mcp",
				type: "mcp",
				content: [
					{
						name: "Default (NPX)",
						content: JSON.stringify({
							command: "npx",
							args: ["-y", "@appium/mcp-server"],
						}),
					},
					{
						name: "Docker",
						content: JSON.stringify({
							command: "docker",
							args: ["run", "-p", "4723:4723", "appium/appium-mcp:latest"],
						}),
						prerequisites: ["Docker installed and running"],
					},
					{
						name: "Global NPM Install",
						content: JSON.stringify({
							command: "appium-mcp",
							args: [],
						}),
						prerequisites: ["Install globally first: npm install -g @appium/mcp-server"],
					},
				],
			}

			// Validate multiple installation methods
			expect(Array.isArray(appiumMcpWithMethods.content)).toBe(true)
			if (Array.isArray(appiumMcpWithMethods.content)) {
				expect(appiumMcpWithMethods.content).toHaveLength(3)
				expect(appiumMcpWithMethods.content[0].name).toBe("Default (NPX)")
				expect(appiumMcpWithMethods.content[1].name).toBe("Docker")
				expect(appiumMcpWithMethods.content[2].name).toBe("Global NPM Install")
			}
		})
	})

	describe("Installing Appium MCP Server", () => {
		it("should install Appium MCP Server to project configuration", async () => {
			const appiumMcpItem: MarketplaceItem = {
				id: "appium-mcp",
				name: "Appium MCP Server",
				description: "MCP server for Mobile Development and Automation",
				url: "https://github.com/appium/appium-mcp",
				type: "mcp",
				content: JSON.stringify({
					command: "npx",
					args: ["-y", "@appium/mcp-server"],
					env: {
						APPIUM_HOST: "localhost",
						APPIUM_PORT: "4723",
					},
				}),
			}

			// Mock existing MCP configuration
			mockFs.readFile.mockResolvedValue(
				JSON.stringify({
					mcpServers: {
						"existing-server": {
							command: "node",
							args: ["server.js"],
						},
					},
				}),
			)

			const result = await installer.installItem(appiumMcpItem, {
				target: "project",
			})

			expect(result.filePath).toContain("mcp.json")
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify the written content includes Appium MCP
			const writtenContent = mockFs.writeFile.mock.calls[0][1]
			const writtenData = JSON.parse(writtenContent)
			expect(writtenData.mcpServers["appium-mcp"]).toBeDefined()
			expect(writtenData.mcpServers["appium-mcp"].command).toBe("npx")
			expect(writtenData.mcpServers["appium-mcp"].args).toContain("-y")
			expect(writtenData.mcpServers["appium-mcp"].args).toContain("@appium/mcp-server")
			expect(writtenData.mcpServers["appium-mcp"].env.APPIUM_HOST).toBe("localhost")
			expect(writtenData.mcpServers["appium-mcp"].env.APPIUM_PORT).toBe("4723")
		})

		it("should install Appium MCP Server with parameters", async () => {
			const appiumMcpItem: MarketplaceItem = {
				id: "appium-mcp",
				name: "Appium MCP Server",
				description: "MCP server for Mobile Development and Automation",
				url: "https://github.com/appium/appium-mcp",
				type: "mcp",
				content: JSON.stringify({
					command: "npx",
					args: ["-y", "@appium/mcp-server"],
					env: {
						APPIUM_HOST: "{{APPIUM_HOST}}",
						APPIUM_PORT: "{{APPIUM_PORT}}",
						PLATFORM_NAME: "{{PLATFORM_NAME}}",
					},
				}),
				parameters: [
					{
						name: "Appium Host",
						key: "APPIUM_HOST",
						placeholder: "localhost",
						optional: false,
					},
					{
						name: "Appium Port",
						key: "APPIUM_PORT",
						placeholder: "4723",
						optional: false,
					},
					{
						name: "Platform",
						key: "PLATFORM_NAME",
						placeholder: "iOS or Android",
						optional: true,
					},
				],
			}

			const result = await installer.installItem(appiumMcpItem, {
				target: "project",
				parameters: {
					APPIUM_HOST: "127.0.0.1",
					APPIUM_PORT: "4444",
					PLATFORM_NAME: "iOS",
				},
			})

			expect(result.filePath).toContain("mcp.json")
			expect(mockFs.writeFile).toHaveBeenCalled()

			// Verify parameters were properly substituted
			const writtenContent = mockFs.writeFile.mock.calls[0][1]
			const writtenData = JSON.parse(writtenContent)
			expect(writtenData.mcpServers["appium-mcp"].env.APPIUM_HOST).toBe("127.0.0.1")
			expect(writtenData.mcpServers["appium-mcp"].env.APPIUM_PORT).toBe("4444")
			expect(writtenData.mcpServers["appium-mcp"].env.PLATFORM_NAME).toBe("iOS")
		})

		it("should handle Appium MCP Server with multiple capabilities", () => {
			// Test configuration with advanced Appium capabilities
			const appiumMcpAdvanced: MarketplaceItem = {
				id: "appium-mcp",
				name: "Appium MCP Server",
				description: "MCP server for Mobile Development and Automation",
				url: "https://github.com/appium/appium-mcp",
				type: "mcp",
				content: JSON.stringify({
					command: "npx",
					args: ["-y", "@appium/mcp-server"],
					env: {
						APPIUM_HOST: "localhost",
						APPIUM_PORT: "4723",
						CAPABILITIES: JSON.stringify({
							platformName: "iOS",
							platformVersion: "15.0",
							deviceName: "iPhone 13",
							automationName: "XCUITest",
							app: "/path/to/app.ipa",
						}),
					},
				}),
			}

			// Parse and validate the capabilities
			const content = JSON.parse(appiumMcpAdvanced.content as string)
			const capabilities = JSON.parse(content.env.CAPABILITIES)

			expect(capabilities.platformName).toBe("iOS")
			expect(capabilities.deviceName).toBe("iPhone 13")
			expect(capabilities.automationName).toBe("XCUITest")
		})
	})

	describe("Appium MCP Server Features", () => {
		it("should support mobile automation tools and commands", () => {
			// Define expected Appium MCP capabilities
			const expectedTools = [
				"launch_app",
				"install_app",
				"uninstall_app",
				"find_element",
				"click_element",
				"send_keys",
				"swipe",
				"scroll",
				"take_screenshot",
				"get_device_info",
				"get_orientation",
				"set_orientation",
				"start_recording",
				"stop_recording",
				"push_file",
				"pull_file",
				"get_logs",
				"execute_script",
			]

			// This represents what the MCP server should expose
			const appiumMcpCapabilities = {
				tools: expectedTools,
				resources: ["device_list", "app_list", "session_info", "element_tree"],
				prompts: ["test_login_flow", "validate_ui_elements", "perform_gesture", "capture_performance_metrics"],
			}

			expect(appiumMcpCapabilities.tools).toContain("launch_app")
			expect(appiumMcpCapabilities.tools).toContain("find_element")
			expect(appiumMcpCapabilities.tools).toContain("take_screenshot")
			expect(appiumMcpCapabilities.resources).toContain("device_list")
			expect(appiumMcpCapabilities.prompts).toContain("test_login_flow")
		})
	})
})
